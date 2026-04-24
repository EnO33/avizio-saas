import { Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Check,
	Edit3,
	Home,
	Inbox,
	Link2,
	Settings,
	Sparkles,
	Store,
} from "lucide-react";
import { Avatar } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Logo } from "#/components/ui/logo";
import { Stars } from "#/components/ui/stars";

/**
 * Hero de la landing — pill d'accroche, titre serif géant avec
 * italiques terracotta sur les deux dernières lignes, double CTA,
 * et aperçu produit en mockup statique pour que le lecteur visualise
 * l'interface avant même de s'inscrire.
 */
export function Hero() {
	return (
		<section className="mx-auto max-w-[1200px] px-7 pt-[88px] pb-20">
			<div className="max-w-[780px]">
				<div className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-[11.5px] text-ink-soft">
					<span className="size-1.5 rounded-full bg-accent" />
					Pensé pour les commerces de proximité français
				</div>
				<h1
					className="m-0 font-serif font-normal text-ink leading-[1.02] tracking-[-0.03em]"
					style={{ fontSize: "clamp(44px, 6vw, 84px)" }}
				>
					Répondez à chaque avis,
					<br />
					<span className="text-accent-ink italic">comme si vous aviez</span>
					<br />
					<span className="text-accent-ink italic">tout votre temps.</span>
				</h1>
				<p className="mt-7 max-w-[560px] text-[18px] text-ink-soft leading-[1.55]">
					Avizio rédige une réponse personnalisée pour chaque avis Google,
					TripAdvisor et Trustpilot. Vous relisez, ajustez, publiez — en deux
					minutes, pas vingt.
				</p>
				<div className="mt-9 flex flex-wrap items-center gap-3">
					<Link to="/sign-up">
						<Button
							variant="accent"
							size="lg"
							iconRight={<ArrowRight size={16} strokeWidth={1.75} />}
						>
							Commencer l'essai · 14 jours
						</Button>
					</Link>
					<a href="#features">
						<Button variant="ghost" size="lg">
							Voir comment ça marche
						</Button>
					</a>
					<span className="text-[12px] text-ink-mute">
						Sans carte bancaire · Résiliation en 1 clic
					</span>
				</div>
			</div>

			<HeroProductMock />
		</section>
	);
}

/*
  Aperçu produit — trois colonnes (sidebar / liste avis / draft IA)
  qui reprennent pixel-près la trame du Shell authentifié. Intérêt
  de mocker plutôt que d'embarquer une vraie capture : pas d'image
  à re-photo-shop chaque itération de design, et on peut raconter
  l'histoire qu'on veut (nom réaliste, extrait d'avis + réponse IA
  déjà polie). Tous les éléments sont statiques, purement visuels.
*/
function HeroProductMock() {
	return (
		<div className="relative mt-[72px]">
			<Card
				padding={0}
				className="overflow-hidden rounded-[20px] shadow-[var(--shadow-lg)]"
			>
				<div
					className="grid min-h-[420px] bg-paper"
					style={{ gridTemplateColumns: "240px 1fr 1fr" }}
				>
					{/* Sidebar mock */}
					<div className="border-line-soft border-r bg-bg-deep p-5">
						<Logo size={18} />
						<div className="mt-7 flex flex-col gap-0.5">
							<MockNavItem icon={Home} label="Tableau de bord" active={false} />
							<MockNavItem
								icon={Inbox}
								label="Boîte de réponses"
								active
								badge={12}
							/>
							<MockNavItem icon={Store} label="Établissements" active={false} />
							<MockNavItem icon={Link2} label="Connexions" active={false} />
							<MockNavItem icon={Settings} label="Paramètres" active={false} />
						</div>
					</div>

					{/* Inbox mock */}
					<div className="border-line-soft border-r p-5">
						<div className="mb-3.5 font-mono text-[11px] text-ink-mute uppercase tracking-[0.06em]">
							À traiter · 12
						</div>
						<MockReviewRow
							initial="CM"
							name="Claire Moreau"
							rating={5}
							highlighted
							body="Soirée mémorable pour notre anniversaire de mariage. Le chef est venu nous présenter chaque plat…"
						/>
						<MockReviewRow
							initial="MD"
							name="Marc D."
							rating={2}
							body="Déçu. Réservation à 20h, on nous installe à 20h35. Le plat principal est arrivé tiède…"
						/>
						<MockReviewRow
							initial="SL"
							name="Sophie L."
							rating={4}
							body="Très bon petit-déjeuner, viennoiseries maison excellentes. Juste un bémol sur le café…"
						/>
						<MockReviewRow
							initial="JR"
							name="Jean-Paul R."
							rating={5}
							body="Vue imprenable sur le lac, chambre impeccable, petit-déjeuner copieux…"
						/>
					</div>

					{/* AI draft mock */}
					<div className="bg-gradient-to-b from-[var(--bg)] to-[var(--paper)] p-6">
						<div className="mb-3.5 flex items-center">
							<Badge tone="accent">
								<Sparkles size={11} strokeWidth={1.75} />
								Généré par IA · ton chaleureux
							</Badge>
						</div>
						<div className="font-serif text-[15px] text-ink leading-[1.6]">
							Chère Claire,
							<br />
							<br />
							Quel plaisir de lire votre message. Fêter votre anniversaire de
							mariage parmi nous, c'est l'exact type de soirée pour laquelle
							Sébastien et son équipe se lèvent le matin…
						</div>
						<div className="mt-4 flex gap-1.5">
							<Button
								variant="outline"
								size="sm"
								icon={<Edit3 size={14} strokeWidth={1.75} />}
							>
								Ajuster
							</Button>
							<Button
								variant="accent"
								size="sm"
								icon={<Check size={14} strokeWidth={1.75} />}
							>
								Approuver
							</Button>
						</div>
					</div>
				</div>
			</Card>
		</div>
	);
}

type MockNavItemProps = {
	readonly icon: typeof Home;
	readonly label: string;
	readonly active: boolean;
	readonly badge?: number;
};

function MockNavItem({ icon: Icon, label, active, badge }: MockNavItemProps) {
	return (
		<div
			className={[
				"flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12.5px]",
				active
					? "border-line-soft bg-paper text-ink"
					: "border-transparent text-ink-mute",
			].join(" ")}
		>
			<Icon size={15} strokeWidth={1.75} aria-hidden="true" />
			<span className="flex-1">{label}</span>
			{badge ? (
				<span className="rounded-full bg-accent px-1.5 font-semibold text-[10px] text-bg">
					{badge}
				</span>
			) : null}
		</div>
	);
}

type MockReviewRowProps = {
	readonly initial: string;
	readonly name: string;
	readonly rating: number;
	readonly body: string;
	readonly highlighted?: boolean;
};

function MockReviewRow({
	initial,
	name,
	rating,
	body,
	highlighted = false,
}: MockReviewRowProps) {
	return (
		<div
			className={[
				"mb-1.5 rounded-lg border p-3",
				highlighted
					? "border-[oklch(0.9_0.04_50)] bg-[oklch(0.96_0.02_50)]"
					: "border-transparent",
			].join(" ")}
		>
			<div className="mb-1 flex items-center gap-2">
				<Avatar initial={initial} size={22} />
				<span className="font-medium text-[12px]">{name}</span>
				<Stars value={rating} size={10} />
			</div>
			<p className="line-clamp-2 text-[12px] text-ink-soft leading-[1.4]">
				{body}
			</p>
		</div>
	);
}
