## Contexte

<!--
Pourquoi cette PR existe. Quel bug, feature ou chore.
Lien vers l'ADR / issue / sprint si applicable.
-->

## Changements

<!-- Liste concise des changements clés (fichiers, comportements). -->

-
-

## Notes

<!--
Décisions d'implémentation non-évidentes, breaking changes, effets de bord,
variables d'env à ajouter, migrations à exécuter, etc.
Supprimer cette section si rien à signaler.
-->

## Test plan

- [ ] `bun run check:all` passe (typecheck + biome + vitest)
- [ ] `bun run build` passe
- [ ] Flow manuel vérifié (indiquer lequel)
- [ ] Screenshots / vidéo si changement UI

## Golden rules checklist

- [ ] Zéro `any`, `unknown` non-narrowé, `as` sans `// cast-reason:`
- [ ] Zéro `try/catch` hors frontière avec lib externe qui throw
- [ ] Erreurs = objets discriminés sur `kind`, pas des `Error` ni des strings
- [ ] Inputs externes validés par Zod (body, query, webhooks, env, réponses d'API)
- [ ] Aucun secret en dur
- [ ] Fichiers < 300 lignes, fonctions < 50 lignes (souple)
- [ ] Pas de commentaire qui paraphrase le code
