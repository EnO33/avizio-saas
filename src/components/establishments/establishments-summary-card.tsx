import { Link } from "@tanstack/react-router";

/**
 * Dashboard widget giving a one-glance view of the establishment roster.
 * Lightweight on purpose — the real editing happens on `/establishments`.
 */
export function EstablishmentsSummaryCard({ count }: { count: number }) {
	return (
		<section className="space-y-3 rounded-lg border border-neutral-200 p-6">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="font-semibold text-lg">Établissements</h2>
					<p className="mt-1 text-neutral-500 text-sm">
						{count === 0
							? "Crée ton premier établissement pour commencer."
							: count === 1
								? "1 établissement géré."
								: `${count} établissements gérés.`}
					</p>
				</div>
				<Link
					to={count === 0 ? "/establishments/new" : "/establishments"}
					className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-sm text-white transition hover:bg-neutral-800"
				>
					{count === 0 ? "Créer" : "Gérer"}
				</Link>
			</div>
		</section>
	);
}
