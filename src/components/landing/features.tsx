import type { LucideIcon } from "lucide-react";
import { Bot, CheckCircle2, MessageSquareQuote, Store } from "lucide-react";

type Feature = {
	icon: LucideIcon;
	title: string;
	body: string;
};

const features: readonly Feature[] = [
	{
		icon: Bot,
		title: "IA contextualisée",
		body: "Ton (chaleureux, pro, direct), métier, contexte de votre établissement — chaque réponse est pensée pour vous.",
	},
	{
		icon: MessageSquareQuote,
		title: "Google, TripAdvisor, Trustpilot",
		body: "Tous vos avis au même endroit. Connectez vos comptes en 2 minutes, Avizio fait le reste.",
	},
	{
		icon: CheckCircle2,
		title: "Validation avant publication",
		body: "L'IA propose, vous décidez. Éditez en 1 clic, publiez quand ça vous va — zéro dérapage.",
	},
	{
		icon: Store,
		title: "Multi-établissements",
		body: "Un seul tableau de bord pour 1 à 5 établissements. Idéal pour les petits groupes et les indépendants qui s'étendent.",
	},
];

export function Features() {
	return (
		<section id="features" className="border-neutral-200 border-t bg-white">
			<div className="mx-auto max-w-6xl px-6 py-20">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="font-bold text-3xl text-neutral-900 tracking-tight md:text-4xl">
						Tout ce qu'il faut pour garder une bonne réputation en ligne
					</h2>
					<p className="mt-4 text-lg text-neutral-600">
						Conçu pour les restaurateurs, hôteliers et commerçants qui veulent
						répondre vite et bien — sans y passer leurs soirées.
					</p>
				</div>
				<div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
					{features.map((f) => (
						<article
							key={f.title}
							className="rounded-lg border border-neutral-200 bg-white p-6"
						>
							<f.icon className="size-6 text-amber-700" />
							<h3 className="mt-4 font-semibold text-lg text-neutral-900">
								{f.title}
							</h3>
							<p className="mt-2 text-neutral-600 text-sm">{f.body}</p>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}
