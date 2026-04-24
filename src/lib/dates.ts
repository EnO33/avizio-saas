/**
 * Formate une date en « lundi 24 avril » (pas d'année) pour les en-têtes
 * de page — les vues dashboard/inbox sont toujours « aujourd'hui »,
 * l'année reste implicite. `new Intl.DateTimeFormat` est recréé à chaque
 * appel parce que le formatter est léger et ça évite un singleton
 * global partageable (testabilité).
 */
export function formatLongDateFr(date: Date): string {
	return new Intl.DateTimeFormat("fr-FR", {
		weekday: "long",
		day: "numeric",
		month: "long",
	}).format(date);
}

/**
 * Variante majuscule pour les kickers mono (ex. « JEUDI 24 AVRIL ») —
 * `toUpperCase` côté français transforme correctement les caractères
 * accentués (É, À…), pas besoin de `toLocaleUpperCase`.
 */
export function formatMonoDateFr(date: Date): string {
	return formatLongDateFr(date).toUpperCase();
}

/**
 * Timestamp relatif à la française : « il y a 5 min / 2 h / 3 j ».
 * Au-delà de 7 jours on bascule sur un format absolu court
 * (« 12 avr. ») parce que « il y a 47 jours » devient illisible.
 * Accepte ISO string ou Date — convenient pour les données serveur.
 */
export function timeAgoFr(
	input: Date | string,
	now: Date = new Date(),
): string {
	const then = typeof input === "string" ? new Date(input) : input;
	const diffMs = now.getTime() - then.getTime();
	const mins = Math.floor(diffMs / 60_000);
	if (mins < 1) return "à l'instant";
	if (mins < 60) return `il y a ${mins} min`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `il y a ${hrs} h`;
	const days = Math.floor(hrs / 24);
	if (days < 7) return `il y a ${days} j`;
	return new Intl.DateTimeFormat("fr-FR", {
		day: "numeric",
		month: "short",
	}).format(then);
}

/**
 * Nombre à virgule française (ex. 4.6 → « 4,6 »). Utile pour les notes
 * étoiles + deltas dans les KPIs. Préféré à `Number.toLocaleString("fr")`
 * parce qu'on veut un séparateur contrôlé sans autres effets de locale
 * (pas d'espace milliers accidentel, pas d'arrondi surprise).
 */
export function formatNumberFr(value: number, fractionDigits = 1): string {
	return value.toFixed(fractionDigits).replace(".", ",");
}
