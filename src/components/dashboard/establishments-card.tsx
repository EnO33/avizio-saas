import { Link } from "@tanstack/react-router";
import { Plus, Star } from "lucide-react";
import { businessTypeLabel } from "#/components/establishments/business-types";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import type { EstablishmentSummary } from "#/server/db/queries/establishments";

type Props = {
	readonly establishments: readonly EstablishmentSummary[];
};

/**
 * Liste compacte des établissements en colonne droite du dashboard.
 * Chaque item est clickable vers la fiche d'édition. Le monogramme
 * serif italique sur fond cream reprend le style de la liste complète
 * pour que l'utilisateur reconnaisse le même « langage » d'un écran
 * à l'autre. Affiche un placeholder « — » pour les ratings tant qu'on
 * ne calcule pas encore l'agrégat en DB.
 */
export function EstablishmentsCard({ establishments }: Props) {
	return (
		<Card padding={20}>
			<div className="mb-3 font-mono text-[11px] text-ink-mute uppercase tracking-[0.08em]">
				Vos établissements
			</div>

			{establishments.length === 0 ? (
				<p className="text-[12.5px] text-ink-mute">
					Aucun établissement pour l'instant.
				</p>
			) : (
				<div className="flex flex-col gap-0.5">
					{establishments.map((est) => (
						<Link
							key={est.id}
							to="/establishments/$id"
							params={{ id: est.id }}
							className="flex items-center gap-2.5 rounded-lg p-2.5 transition-colors hover:bg-bg-deep"
						>
							<div className="flex size-[34px] shrink-0 items-center justify-center rounded-[7px] bg-bg-deep font-serif text-[17px] text-accent-ink italic">
								{est.name.charAt(0).toUpperCase()}
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate font-medium text-[13px]">
									{est.name}
								</div>
								<div className="flex items-center gap-1 text-[11px] text-ink-mute">
									<span>{businessTypeLabel(est.businessType)}</span>
									<span>·</span>
									<span>{est.city}</span>
									<span>·</span>
									<Star size={9} strokeWidth={1.75} />
									<span>—</span>
								</div>
							</div>
						</Link>
					))}
				</div>
			)}

			<Link to="/establishments/new" className="block">
				<Button
					variant="ghost"
					size="sm"
					icon={<Plus size={14} strokeWidth={1.75} />}
					className="mt-2.5 w-full justify-start"
				>
					Ajouter un établissement
				</Button>
			</Link>
		</Card>
	);
}
