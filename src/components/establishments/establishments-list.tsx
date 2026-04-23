import { Link } from "@tanstack/react-router";
import type { EstablishmentSummary } from "#/server/db/queries/establishments";
import { businessTypeLabel } from "./business-types";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export function EstablishmentsList({
	establishments,
}: {
	establishments: readonly EstablishmentSummary[];
}) {
	return (
		<ul className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 bg-white">
			{establishments.map((e) => (
				<EstablishmentRow key={e.id} establishment={e} />
			))}
		</ul>
	);
}

function EstablishmentRow({
	establishment,
}: {
	establishment: EstablishmentSummary;
}) {
	const locationLine = establishment.postalCode
		? `${establishment.postalCode} ${establishment.city}`
		: establishment.city;

	return (
		<li>
			<Link
				to="/establishments/$id"
				params={{ id: establishment.id }}
				className="flex items-center justify-between gap-4 p-4 transition hover:bg-neutral-50"
			>
				<div className="min-w-0">
					<div className="font-medium text-neutral-900 text-sm">
						{establishment.name}
					</div>
					<div className="mt-1 text-neutral-500 text-xs">
						{businessTypeLabel(establishment.businessType)}
						{" · "}
						{locationLine}
						{" · Créé le "}
						{dateFormatter.format(new Date(establishment.createdAt))}
					</div>
				</div>
				<span aria-hidden="true" className="shrink-0 text-neutral-400 text-sm">
					→
				</span>
			</Link>
		</li>
	);
}
