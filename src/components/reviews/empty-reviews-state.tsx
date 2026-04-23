import { Link } from "@tanstack/react-router";

/**
 * Renders the empty state on `/reviews`. The message changes based on
 * whether the org has any platform connected — a user with zero
 * connections needs a different nudge (connect first) than one who is
 * connected but hasn't had a fetch run yet.
 */
export function EmptyReviewsState({
	hasConnection,
}: {
	hasConnection: boolean;
}) {
	return (
		<div className="flex flex-col items-center gap-4 rounded-lg border border-neutral-200 border-dashed bg-white px-8 py-16 text-center">
			<InboxIcon />
			<div className="max-w-md space-y-2">
				<h2 className="font-semibold text-lg text-neutral-900">
					Aucun avis pour l'instant
				</h2>
				<p className="text-neutral-600 text-sm">
					{hasConnection
						? "Les avis sont récupérés automatiquement depuis tes plateformes connectées. Ils apparaîtront ici dès le prochain cycle de synchronisation."
						: "Connecte au moins une plateforme pour commencer à recevoir les avis de tes établissements."}
				</p>
			</div>
			{!hasConnection ? (
				<Link
					to="/dashboard"
					className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-neutral-800"
				>
					Connecter une plateforme
				</Link>
			) : null}
		</div>
	);
}

function InboxIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			className="size-12 text-neutral-300"
			aria-hidden="true"
			role="presentation"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<title>Boîte vide</title>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"
			/>
		</svg>
	);
}
