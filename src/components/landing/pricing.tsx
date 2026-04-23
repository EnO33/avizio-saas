import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

type Plan = {
	name: string;
	price: number;
	unit: string;
	billingNote: string;
	highlight: boolean;
	badge?: string;
	features: readonly string[];
};

const plans: readonly Plan[] = [
	{
		name: "Mensuel",
		price: 39,
		unit: "€ / mois / établissement",
		billingNote: "Facturation mensuelle, sans engagement.",
		highlight: false,
		features: [
			"Réponses illimitées générées par IA",
			"Google, TripAdvisor, Trustpilot",
			"Jusqu'à 5 établissements",
			"Notifications sur avis négatif",
			"Historique et audit trail",
		],
	},
	{
		name: "Annuel",
		price: 29,
		unit: "€ / mois / établissement",
		billingNote: "Facturation annuelle. 25 % d'économie.",
		highlight: true,
		badge: "Recommandé",
		features: [
			"Tout du plan mensuel",
			"25 % de remise vs. mensuel",
			"Onboarding prioritaire",
			"Support email < 24h",
		],
	},
];

export function Pricing() {
	return (
		<section id="pricing" className="border-neutral-200 border-t bg-white">
			<div className="mx-auto max-w-6xl px-6 py-20">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="font-bold text-3xl text-neutral-900 tracking-tight md:text-4xl">
						Tarifs simples, pas de mauvaise surprise
					</h2>
					<p className="mt-4 text-lg text-neutral-600">
						14 jours d'essai gratuit. Sans carte bancaire. Résiliable en 1 clic.
					</p>
				</div>
				<div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-8">
					{plans.map((plan) => (
						<article
							key={plan.name}
							className={
								plan.highlight
									? "relative rounded-xl border-2 border-amber-500 bg-white p-8 shadow-lg"
									: "relative rounded-xl border border-neutral-200 bg-white p-8"
							}
						>
							{plan.badge ? (
								<span className="absolute top-0 right-6 -translate-y-1/2 rounded-full bg-amber-500 px-3 py-1 font-medium text-white text-xs">
									{plan.badge}
								</span>
							) : null}
							<h3 className="font-semibold text-neutral-900 text-xl">
								{plan.name}
							</h3>
							<div className="mt-4 flex items-baseline gap-1">
								<span className="font-bold text-5xl text-neutral-900">
									{plan.price}
								</span>
								<span className="text-neutral-600 text-sm">{plan.unit}</span>
							</div>
							<p className="mt-2 text-neutral-500 text-xs">
								{plan.billingNote}
							</p>
							<ul className="mt-6 space-y-3">
								{plan.features.map((feat) => (
									<li
										key={feat}
										className="flex items-start gap-2 text-neutral-700 text-sm"
									>
										<Check className="mt-0.5 size-4 shrink-0 text-amber-700" />
										<span>{feat}</span>
									</li>
								))}
							</ul>
							<Link
								to="/sign-up"
								className={
									plan.highlight
										? "mt-8 block w-full rounded-md bg-neutral-900 py-3 text-center font-medium text-sm text-white hover:bg-neutral-800"
										: "mt-8 block w-full rounded-md border border-neutral-200 bg-white py-3 text-center font-medium text-neutral-900 text-sm hover:bg-neutral-50"
								}
							>
								Essai gratuit 14 jours
							</Link>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}
