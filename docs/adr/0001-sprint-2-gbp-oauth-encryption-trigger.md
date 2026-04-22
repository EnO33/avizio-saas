# ADR 0001 — Sprint 2 : intégration Google Business Profile + chiffrement des tokens + Trigger.dev

- **Date** : 2026-04-22
- **Status** : Proposed
- **Contexte Sprint** : S2 (après Sprint 1 Foundation)

## Contexte

Sprint 2 ajoute la première plateforme d'avis (Google Business Profile, GBP) et la boucle cron qui récupère les avis. Trois décisions à figer avant d'écrire une ligne de code, parce qu'elles se propagent partout :

1. **Comment on orchestre OAuth2 avec Google** — flow, scopes, stockage des tokens
2. **Comment on chiffre les tokens OAuth au repos** — algo, rotation, format
3. **Comment on schedule et retry les jobs** (fetch reviews 4x/jour, refresh tokens avant expiration) — quel fournisseur, quelle granularité

Les règles internes du repo fixent déjà les contraintes :
- OAuth tokens chiffrés au repos (pgcrypto AES-256-GCM ou libsodium)
- Multi-tenant strict : chaque token appartient à un `establishment` qui appartient à une `organization` Clerk
- Zéro secret en dur, tout via `src/lib/env.ts`
- Rate limiting Upstash sur routes publiques
- Audit trail immuable sur publication

Le schema Drizzle (PR #2) prévoit déjà `connections.encryptedAccessToken`, `connections.encryptedRefreshToken`, `connections.accessTokenExpiresAt`, `connections.scopes`. On n'a plus qu'à câbler.

## Décisions

### D1 — Flow OAuth2 GBP

**Library** : `google-auth-library` (officiel Google, maintenu, léger).

**Scopes demandés** : `https://www.googleapis.com/auth/business.manage` (scope unique, nécessaire pour list locations + list reviews + reply). Pas de `profile`/`email` — on a déjà l'identité via Clerk.

**Routes à créer** :
- `GET /api/oauth/google/start?establishmentId=xxx` → génère state CSRF, stocke dans cookie HttpOnly `avizio_oauth_state` (10 min TTL), redirige vers `accounts.google.com/o/oauth2/v2/auth` avec `access_type=offline&prompt=consent` (pour avoir le refresh token à chaque fois).
- `GET /api/oauth/google/callback?code=...&state=...` → vérifie state cookie, échange code contre tokens, chiffre, insère dans `connections`, redirige vers `/establishments/$id`.

**State/CSRF** : cookie HttpOnly + SameSite=Lax signé avec une clé dédiée (`OAUTH_STATE_SECRET`). Contient `{ establishmentId, nonce, issuedAt }`. On vérifie nonce + issuedAt <10min + establishmentId correspond à celui en query.

**Erreurs** : retour des `kind` discriminés (`oauth_state_mismatch`, `oauth_state_expired`, `oauth_code_exchange_failed`, `oauth_scope_denied`), mappés à des messages user-friendly dans l'UI.

**Alternative écartée** : OpenID Connect avec Clerk comme IdP unique pour Google — Clerk supporte Google social login, mais les scopes `business.manage` ne sont pas exposables par Clerk (il gère l'auth utilisateur, pas les scopes d'API tiers). Deux flows distincts nécessaires : Clerk = "qui est l'utilisateur", GBP OAuth = "autorisation de ce commerce sur GBP".

### D2 — Chiffrement des tokens OAuth

**Algo** : AES-256-GCM via `node:crypto` (zéro dépendance ajoutée, primitive auditée par Node core).

**Pas de `pgcrypto`** : on fait de l'application-layer pour (a) pouvoir rotate la clé sans toucher à la DB, (b) logger qui a déchiffré quoi côté app, (c) découpler du backend DB (si on change Neon pour autre chose un jour).

**Pas de `libsodium-wrappers`** : `node:crypto` fait le job, éviter un dep externe (~200 kB) pour une primitive native.

**Format stocké** (string `text` en DB) : `v<version>:<nonce-base64>:<ciphertext-and-tag-base64>` — exemple : `v1:aGVsbG8:d29ybGQrdGFn`.

**Rotation** : 
- Les clés vivent dans l'env var `ENCRYPTION_KEYS_JSON` = `{"v1": "<base64-32-bytes>", "v2": "<base64-32-bytes>"}`.
- Écriture = toujours la plus récente (`ENCRYPTION_KEY_CURRENT=v2`).
- Lecture = on parse le prefix `v<n>:` et on choisit la bonne clé.
- Rotation effective = déployer avec `ENCRYPTION_KEYS_JSON` ayant les 2 versions + `CURRENT=v2`, laisser le trafic ré-écrire progressivement (lazy re-encrypt sur accès), puis un job `trigger/re-encrypt-old-tokens.ts` bat le reste une fois, puis on peut retirer v1.

**Module** : `src/lib/crypto.ts` expose `encryptToken(plain): Result<string, CryptoError>` et `decryptToken(stored): Result<string, CryptoError>`. Aucun `try/catch` visible ailleurs — tout passe par Result.

**Génération de clé** : documenté dans le README — `bun -e "console.log(crypto.getRandomValues(new Uint8Array(32)).toBase64())"` ou équivalent.

**Alternative écartée** : un KMS externe (AWS KMS, GCP KMS) — overkill pour MVP, latence réseau par encrypt/decrypt, dépendance cloud supplémentaire. À reconsidérer au moment de la conformité SOC2 si on y va.

### D3 — Trigger.dev v3 pour les jobs cron

**Pourquoi pas Vercel Cron** : Vercel Cron est simple mais n'a pas de retries gérés, pas d'observabilité par exécution, pas de queueing. Les jobs GBP vont être flaky (quota, network, tokens expirés) — on a besoin de retries exponentiels et d'un dashboard pour débugger.

**Pourquoi pas une alternative self-hosted (BullMQ + Redis)** : plus de complexité d'infra pour 1-2 jobs cron au départ. Trigger.dev v3 a un free tier généreux (3000 runs/mois) qui couvre l'early beta (5 établissements × 4 fetches × 30 jours = 600 runs, marge confortable).

**Jobs à prévoir** :
- `trigger/fetch-reviews-establishment.ts` — déclenché par un cron par établissement (fanout), ou par un cron global qui itère sur les `connections` actives. Choix retenu : **cron global** `fetch-reviews-all` toutes les 6h (4x/jour) qui query `connections WHERE revokedAt IS NULL AND platform='google'`, puis un `batchTrigger` pour fanout par connection. Plus simple à rate-limiter.
- `trigger/refresh-oauth-tokens.ts` — cron horaire qui query `connections WHERE accessTokenExpiresAt < now() + interval '2 hours' AND revokedAt IS NULL`, puis `batchTrigger` pour refresh chacun.
- Retries : `retry: { maxAttempts: 5, backoff: 'exponential', factor: 2, minDelayMs: 1000 }`.
- Timeout par run : 60s.

**Env requis** : `TRIGGER_SECRET_KEY` (prod + dev distincts). Le compte Trigger.dev est à créer par le user avant ce sprint.

**Alternative écartée** : `node-cron` dans un container serverless — Vercel functions ne persistent pas, pas de scheduler built-in. Même problème que Vercel Cron.

### D4 — Ordre de merge des branches

Pour éviter les conflits :
1. **`feat/core-lib-crypto`** → ajoute `src/lib/crypto.ts` + `ENCRYPTION_KEYS_JSON` dans env.ts. Tests unitaires sur encrypt/decrypt round-trip + rotation.
2. **`feat/gbp-oauth`** → `google-auth-library`, route start/callback, insert dans `connections`, étend env.ts avec `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `OAUTH_STATE_SECRET`.
3. **`feat/gbp-service`** → `src/server/integrations/google-business.ts` (list locations, list reviews, reply), utilise le client OAuth qu'on a construit. Services purs, Result-based.
4. **`feat/trigger-setup`** → init Trigger.dev dans le repo + job `fetch-reviews-all` + `refresh-oauth-tokens`. Étend env.ts avec `TRIGGER_SECRET_KEY`.
5. **`feat/reviews-list-ui`** — liste filtrable des reviews dans le dashboard, premier usage visible des données.

5 branches, chacune mergeable seule (core-lib-crypto n'a aucune dep externe ; gbp-oauth dépend de crypto ; etc.).

## Conséquences

### Ce qu'il faut côté infrastructure (bloquant avant de démarrer)

1. **Google Cloud Project** créé, **Business Profile API** activée (console.cloud.google.com → APIs & Services → Library → "Business Profile API" → Enable). Quotas : 100 requêtes/jour par défaut, suffisant pour beta.
2. **OAuth 2.0 Client ID** (Web application) créé dans la console, avec :
   - Authorized JavaScript origins : `http://localhost:3000`, `https://app.avizio.fr` (prod)
   - Authorized redirect URIs : `http://localhost:3000/api/oauth/google/callback`, `https://app.avizio.fr/api/oauth/google/callback`
3. **Compte Trigger.dev** créé, projet "avizio-saas" initialisé, secret key copiée.
4. **Clé de chiffrement** générée en local et ajoutée à `.env` (dev) + Vercel env vars (prod).

### Ce qu'on gagne / ce qu'on paie

- **Gain** : boucle complète "avis récupéré → affiché → répondable" fonctionnelle fin Sprint 2, pour GBP uniquement. TripAdvisor/Trustpilot se calquent en copiant `google-business.ts` → `tripadvisor.ts` avec les mêmes contrats de Result.
- **Coût dep** : +1 prod dep (`google-auth-library`, ~300kB), +1 dev dep (`@trigger.dev/sdk` v3). Pas de crypto dep.
- **Coût infra** : compte Trigger.dev (free tier), projet Google Cloud (free si on reste dans les quotas).
- **Dette possible** : gestion de la révocation des tokens côté Google (si un user révoque depuis Google, on apprend l'invalidation au prochain appel qui échoue). Pas bloquant pour MVP, à documenter en owner-facing.

## Ouvertures

- **Webhook GBP** pour push-based fetch (évite le polling) : GBP n'a historiquement pas supporté les webhooks. À re-checker en Sprint 3 si une API push existe.
- **Multi-compte Google par établissement** : actuellement 1 connection = 1 compte Google par plateforme et par établissement. Si un utilisateur gère plusieurs comptes GBP pour le même établissement (cas rare), supporter côté UI plus tard.
