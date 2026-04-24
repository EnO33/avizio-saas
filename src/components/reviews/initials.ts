/**
 * Extrait 1-2 lettres d'un nom d'auteur pour alimenter l'avatar.
 * Ex. « Jean-Paul Roux » → « JR », « Claire » → « C », « Marc D. » → « MD ».
 * `split(/\s+/)` couvre espaces et tabs. `slice(0, 2)` borne les noms
 * composés comme « Marie-Anne Dupont » à deux lettres au lieu de cinq.
 * Si tout tombe à vide (ne devrait pas arriver en DB), fallback « ? ».
 */
export function getReviewInitials(name: string): string {
	const parts = name.trim().split(/\s+/);
	const letters = parts
		.slice(0, 2)
		.map((p) => p.charAt(0).toUpperCase())
		.join("");
	return letters || "?";
}
