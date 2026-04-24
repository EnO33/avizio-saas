import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Divider } from "#/components/ui/divider";

type Plan = {
	readonly kind: "monthly" | "annual";
	readonly kicker: string;
	readonly price: string;
	readonly billingNote: string;
	readonly features: readonly string[];
	readonly ctaLabel: string;
	readonly highlighted: boolean;
};

const PLANS: readonly Plan[] = [
	{
		kind: "monthly",
		kicker: "Mensuel",
		price: "39€",
		billingNote: "par mois · par établissement",
		features: [
			"Avis illimités",
			"Google + TripAdvisor + Trustpilot",
			"3 tons de réponse",
			"Historique des publications",
			"Support par email",
		],
		ctaLabel: "Commencer l'essai",
		highlighted: false,
	},
	{
		kind: "annual",
		kicker: "Annuel",
		price: "29€",
		billingNote: "par mois · facturé annuellement",
		features: [
			"Tout ce qui est dans Mensuel",
			"Multi-établissements (jusqu'à 5)",
			"Rapports PDF mensuels",
			"Support prioritaire",
		],
		ctaLabel: "Commencer l'essai",
		highlighted: true,
	},
];

export function Pricing() {
	return (
		<section id="pricing" className="mx-auto max-w-[1200px] px-7 py-20">
			<div className="mb-12 text-center">
				<h2
					className="m-0 font-serif font-normal text-ink tracking-[-0.02em]"
					style={{ fontSize: 56 }}
				>
					Un tarif,{" "}
					<span className="text-accent-ink italic">sans surprise.</span>
				</h2>
				<p className="mt-3 text-ink-soft">
					Par établissement. Annulez quand vous voulez.
				</p>
			</div>

			<div
				className="mx-auto grid max-w-[880px] gap-5"
				style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}
			>
				{PLANS.map((plan) => (
					<PricingCard key={plan.kind} plan={plan} />
				))}
			</div>
		</section>
	);
}

/*
  La carte « annuel » a un gradient accent-soft qui s'estompe vers
  paper — le header de la carte reste chaleureux, le contenu reste
  lisible. Le badge « Le plus choisi · –25% » est posé en absolute
  au-dessus du border, avec un offset négatif, pour flotter plutôt
  que rentrer dans le padding de la carte.
*/
function PricingCard({ plan }: { plan: Plan }) {
	const highlighted = plan.highlighted;
	return (
		<Card
			padding={32}
			className={
				highlighted
					? "relative border-accent bg-gradient-to-b from-[oklch(0.96_0.03_50)] to-paper"
					: "relative"
			}
		>
			{highlighted ? (
				<div className="-top-3 absolute left-7">
					<Badge tone="accent">Le plus choisi · –25%</Badge>
				</div>
			) : null}

			<div className="font-mono text-[11px] text-ink-mute uppercase tracking-[0.08em]">
				{plan.kicker}
			</div>
			<div
				className={[
					"my-3 font-serif leading-[1]",
					highlighted ? "text-accent-ink" : "text-ink",
				].join(" ")}
				style={{ fontSize: 64 }}
			>
				{plan.price}
			</div>
			<div className="text-[13px] text-ink-mute">{plan.billingNote}</div>

			<Divider style={{ margin: "24px 0" }} />

			<ul className="m-0 flex list-none flex-col gap-2.5 p-0">
				{plan.features.map((feat) => (
					<li
						key={feat}
						className="flex items-start gap-2 text-[13.5px] text-ink-soft"
					>
						<Check
							size={16}
							strokeWidth={1.75}
							className="mt-0.5 shrink-0 text-ink-soft"
						/>
						{feat}
					</li>
				))}
			</ul>

			<Link to="/sign-up" className="mt-7 block">
				<Button
					variant={highlighted ? "accent" : "outline"}
					size="lg"
					className="w-full"
					iconRight={
						highlighted ? (
							<ArrowRight size={16} strokeWidth={1.75} />
						) : undefined
					}
				>
					{plan.ctaLabel}
				</Button>
			</Link>
		</Card>
	);
}
