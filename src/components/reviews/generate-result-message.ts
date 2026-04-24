import type { GenerateResponseDraftUiResult } from "#/server/fns/responses";

/**
 * Traduit une erreur du server fn de génération en message FR à
 * afficher à l'utilisateur. Un discriminated union → message lookup
 * dédié pour que l'UX reste homogène entre les différents points
 * d'entrée (bouton générer, régénération, changement de ton…) et
 * pour que l'ajout d'un nouveau kind ne fasse que lever une erreur
 * TS dans le switch — plus rien d'autre à toucher.
 */
export function generateResultToMessage(
	result: GenerateResponseDraftUiResult,
): string {
	switch (result.kind) {
		case "ok":
			return "";
		case "unauthenticated":
			return "Ta session a expiré. Reconnecte-toi.";
		case "review_not_found":
			return "Cet avis n'existe plus. Retourne à la liste.";
		case "ai_rate_limited":
			return "Anthropic a limité la cadence. Réessaie dans une minute.";
		case "ai_safety_block":
			return "L'IA a refusé de répondre à cet avis. Rédige la réponse à la main ou contacte le support.";
		case "ai_no_credits":
			return "Crédit Anthropic épuisé. Recharge ton compte sur console.anthropic.com/settings/billing puis réessaie.";
		case "ai_error":
			return "Erreur inattendue côté IA. Réessaie dans un instant.";
		case "db_error":
			return "Impossible d'enregistrer le brouillon. Réessaie.";
	}
}
