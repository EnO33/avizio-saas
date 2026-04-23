/**
 * Renders the feedback banner the OAuth callback route redirects the user
 * back to. Matches on the `connected` / `error` search params the callback
 * sets and maps each error slug to a human-readable French message.
 */
export function OAuthResultBanner(props: {
	connected: "google" | undefined;
	error: string | undefined;
}) {
	if (props.connected === "google") {
		return (
			<div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 text-sm">
				Google Business Profile connecté. Les avis arriveront bientôt.
			</div>
		);
	}

	if (!props.error) return null;

	return (
		<div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-900 text-sm">
			{oauthErrorToMessage(props.error)}
		</div>
	);
}

function oauthErrorToMessage(slug: string): string {
	switch (slug) {
		case "oauth_denied":
			return "Connexion annulée côté Google. Réessaie quand tu es prêt.";
		case "oauth_missing_code":
		case "oauth_missing_state":
			return "Paramètres manquants dans la réponse Google. Relance la connexion.";
		case "oauth_state_invalid":
		case "oauth_state_mismatch":
			return "Le lien de connexion n'est plus valide (expiré ou altéré). Relance la connexion.";
		case "oauth_token_exchange":
			return "Google a refusé l'échange du code. Relance la connexion — si ça persiste, ton token Google est peut-être révoqué.";
		case "oauth_id_token":
			return "La réponse de Google est invalide. Contacte le support si l'erreur persiste.";
		case "oauth_crypto":
			return "Impossible de chiffrer les tokens. Contacte le support.";
		case "oauth_db":
			return "Impossible d'enregistrer la connexion. Réessaie dans un instant.";
		default:
			return "Erreur inattendue pendant la connexion Google.";
	}
}
