import { createFileRoute } from "@tanstack/react-router";

/*
  Route placeholder — l'écran définitif arrive dans une PR dédiée
  (listing des plateformes avec statuts connected / disconnected /
  expired / soon). Pour l'instant le nav item de la sidebar pointe ici
  pour ne pas 404, et on renvoie juste un message d'attente cohérent
  avec le reste du design.
*/
export const Route = createFileRoute("/_authed/connections")({
	component: ConnectionsPage,
});

function ConnectionsPage() {
	return (
		<main className="mx-auto max-w-[880px] p-10">
			<div className="font-mono text-[12px] text-ink-mute uppercase tracking-[0.08em]">
				Connexions
			</div>
			<h1 className="mt-1.5 font-serif font-normal text-[40px] text-ink tracking-[-0.02em]">
				Plateformes.
			</h1>
			<p className="mt-1 text-[14px] text-ink-soft">
				Connectez vos comptes pour récupérer vos avis automatiquement.
			</p>

			<div className="mt-8 rounded-lg border border-line-soft bg-paper p-6 shadow-sm">
				<p className="text-[13.5px] text-ink-soft leading-[1.6]">
					Cet écran est en cours de redesign. Pour gérer votre connexion Google
					Business Profile en attendant, passez par la fiche d'un établissement
					depuis{" "}
					<a
						href="/establishments"
						className="font-medium text-accent-ink underline"
					>
						vos adresses
					</a>
					.
				</p>
			</div>
		</main>
	);
}
