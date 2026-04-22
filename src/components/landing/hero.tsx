import { SignUpButton } from "@clerk/tanstack-react-start";
import { Sparkles } from "lucide-react";

export function Hero() {
	return (
		<section className="relative overflow-hidden bg-gradient-to-b from-amber-50/60 to-white">
			<div className="mx-auto max-w-6xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
				<div className="mx-auto max-w-3xl text-center">
					<div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-amber-900 text-xs">
						<Sparkles className="size-3.5" />
						<span>Pensé pour les commerces de proximité français</span>
					</div>
					<h1 className="mt-6 font-bold text-4xl text-neutral-900 tracking-tight md:text-6xl">
						Répondez à chaque avis client,
						<br />
						<span className="text-amber-700">
							même quand vous n'avez pas le temps.
						</span>
					</h1>
					<p className="mt-6 text-lg text-neutral-600 md:text-xl">
						Avizio génère des réponses personnalisées pour vos avis Google,
						TripAdvisor et Trustpilot. Vous validez, vous publiez — 30 minutes
						économisées chaque jour.
					</p>
					<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
						<SignUpButton>
							<button
								type="button"
								className="rounded-md bg-neutral-900 px-6 py-3 font-medium text-sm text-white hover:bg-neutral-800"
							>
								Commencer l'essai gratuit — 14 jours
							</button>
						</SignUpButton>
						<a
							href="#how-it-works"
							className="rounded-md border border-neutral-200 bg-white px-6 py-3 font-medium text-neutral-900 text-sm hover:bg-neutral-50"
						>
							Voir comment ça marche
						</a>
					</div>
					<p className="mt-4 text-neutral-500 text-xs">
						Sans carte bancaire · Annulation en 1 clic
					</p>
				</div>
			</div>
		</section>
	);
}
