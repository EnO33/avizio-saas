import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Store } from "lucide-react";
import { EstablishmentsList } from "#/components/establishments/establishments-list";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { listEstablishments } from "#/server/fns/establishments";

export const Route = createFileRoute("/_authed/establishments/")({
	loader: async () => ({ establishments: await listEstablishments() }),
	component: EstablishmentsPage,
});

function EstablishmentsPage() {
	const { establishments } = Route.useLoaderData();
	const count = establishments.length;

	return (
		<div
			className="mx-auto px-4 py-6 sm:px-6 md:px-10 md:py-8"
			style={{ maxWidth: 1280 }}
		>
			<div className="mb-8 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<div className="font-mono text-[12px] text-ink-mute uppercase tracking-[0.08em]">
						Établissements
					</div>
					<h1 className="m-[6px_0_4px] font-serif font-normal text-[30px] text-ink tracking-[-0.02em] sm:text-[40px]">
						Vos adresses.
					</h1>
					<p className="m-0 text-[14px] text-ink-soft">
						{count === 0
							? "Ajoutez votre premier établissement pour commencer."
							: count === 1
								? "1 établissement · Plan annuel"
								: `${count} établissements · Plan annuel`}
					</p>
				</div>
				{count > 0 ? (
					<Link to="/establishments/new">
						<Button
							variant="accent"
							size="md"
							icon={<Plus size={14} strokeWidth={1.75} />}
						>
							Ajouter un établissement
						</Button>
					</Link>
				) : null}
			</div>

			<EstablishmentsList establishments={establishments} />

			{/* Carte explicative — rappel de la granularité « un étab = une
			    identité ». Affichée même quand la liste est vide, ça rassure
			    l'utilisateur qui démarre sur le produit. */}
			<Card padding={22} tone="cream" className="mt-6 flex items-start gap-5">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-paper text-accent-ink">
					<Store size={20} strokeWidth={1.75} />
				</div>
				<div>
					<div className="font-serif text-[20px] leading-[1.2]">
						Un établissement = une identité
					</div>
					<p className="mt-1.5 text-[13px] text-ink-soft leading-[1.5]">
						Chaque établissement a son propre ton, son contexte de marque et ses
						connexions aux plateformes. Parfait pour gérer plusieurs adresses
						sans les mélanger.
					</p>
				</div>
			</Card>
		</div>
	);
}
