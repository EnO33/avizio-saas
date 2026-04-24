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
import { PlatformIcon } from "#/components/ui/platform-icon";
import { Stars } from "#/components/ui/stars";

/**
 * Hero de la landing — grille 2 colonnes en desktop (texte à gauche,
 * visuel flottant à droite), qui se recolle en 1 colonne texte-seul
 * sous `lg:` pour que le mobile reste punchy. Pill d'accroche, titre
 * serif géant avec italiques terracotta sur les deux dernières lignes,
 * double CTA, et aperçu produit en mockup statique au-dessous pour
 * que le lecteur visualise l'interface avant même de s'inscrire.
 */
export function Hero() {
	return (
		<section className="mx-auto max-w-[1200px] px-7 pt-[88px] pb-20">
			<div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
				<div>
					<div className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-[11.5px] text-ink-soft">
						<span className="size-1.5 rounded-full bg-accent" />
						Pensé pour les commerces de proximité français
					</div>
					<h1
						className="m-0 font-serif font-normal text-ink leading-[1.02] tracking-[-0.03em]"
						style={{ fontSize: "clamp(44px, 5.2vw, 76px)" }}
					>
						Répondez à chaque avis,
						<br />
						<span className="text-accent-ink italic">comme si vous aviez</span>
						<br />
						<span className="text-accent-ink italic">tout votre temps.</span>
					</h1>
					<p className="mt-7 max-w-[520px] text-[17px] text-ink-soft leading-[1.55]">
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
						<a href="#demo">
							<Button variant="ghost" size="lg">
								Voir une démo
							</Button>
						</a>
					</div>
					<div className="mt-4 text-[12px] text-ink-mute">
						Sans carte bancaire · Résiliation en 1 clic
					</div>
				</div>

				<HeroVisual />
			</div>

			<HeroProductMock />
		</section>
	);
}

/*
  Visuel droit de la hero — deux cartes flottantes qui racontent le flow
  avis entrant → brouillon IA, avec une pastille "AVIZIO · 8 SEC" qui
  matérialise l'étape intermédiaire. Caché en `< lg:` parce que la mise
  en scène demande ~460px de large + une hauteur dédiée : en mobile le
  texte porte seul le message, ce qui reste plus lisible qu'un visuel
  compressé.
*/
function HeroVisual() {
	return (
		<div className="relative hidden h-[520px] lg:block">
			{/* Halo ambient — radial gradient accent-soft qui sort du cadre. */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute z-0"
				style={{
					inset: -40,
					background:
						"radial-gradient(circle at 60% 40%, oklch(0.94 0.06 50 / 0.55) 0%, transparent 60%)",
				}}
			/>

			{/* Card 1 — avis entrant Google. */}
			<div
				className="absolute top-[10px] left-0 z-[2] w-[330px] rounded-[16px] border border-line-soft bg-paper p-5"
				style={{
					boxShadow:
						"0 20px 40px -24px rgba(60,40,20,0.18), 0 2px 6px rgba(60,40,20,0.06)",
					transform: "rotate(-2deg)",
				}}
			>
				<div className="mb-3 flex items-center gap-2.5">
					<PlatformIcon platform="google" size={22} />
					<div
						className="font-mono text-[11px] text-ink-mute"
						style={{ letterSpacing: "0.06em" }}
					>
						GOOGLE · IL Y A 2 H
					</div>
				</div>
				<div className="mb-2.5 flex items-center gap-2.5">
					<Avatar initial="C" size={34} />
					<div className="min-w-0">
						<div className="font-medium text-[13px]">Claire M.</div>
						<div className="mt-0.5">
							<Stars value={5} size={11} />
						</div>
					</div>
				</div>
				<p className="m-0 text-[12.5px] text-ink-soft leading-[1.55]">
					« Soirée <em>magnifique</em> pour nos 10 ans de mariage. Le chef est
					passé nous saluer — un vrai moment. On reviendra c'est certain ! »
				</p>
			</div>

			{/* Pastille de flow — matérialise l'étape IA entre les deux cartes. */}
			<div
				className="absolute top-[212px] left-[150px] z-[3] inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1.5 font-medium font-mono text-[11px]"
				style={{
					color: "oklch(0.98 0.012 85)",
					letterSpacing: "0.04em",
					boxShadow: "0 6px 14px rgba(60,40,20,0.18)",
				}}
			>
				<span className="inline-flex size-[14px] items-center justify-center rounded-full bg-accent">
					<Sparkles
						size={9}
						strokeWidth={1.75}
						className="text-[color:oklch(0.98_0.012_85)]"
					/>
				</span>
				AVIZIO · 8 SEC
			</div>

			{/* Card 2 — brouillon IA. */}
			<div
				className="absolute top-[235px] right-0 z-[4] w-[360px] rounded-[16px] border bg-paper p-[22px]"
				style={{
					borderColor: "oklch(0.88 0.04 50)",
					boxShadow:
						"0 28px 50px -24px rgba(170,70,40,0.22), 0 2px 6px rgba(60,40,20,0.06)",
					transform: "rotate(1.5deg)",
				}}
			>
				<div className="mb-3.5 flex items-center justify-between">
					<Badge tone="accent">
						<Sparkles size={11} strokeWidth={1.75} />
						Brouillon · ton chaleureux
					</Badge>
					<span
						className="font-mono text-[10px] text-ink-mute"
						style={{ letterSpacing: "0.04em" }}
					>
						v1 · 312 car.
					</span>
				</div>
				<div className="my-1 mb-4 border-accent border-l-[2px] pl-3.5 font-serif text-[14.5px] text-ink italic leading-[1.55]">
					Chère Claire,
					<br />
					Fêter vos{" "}
					<span
						className="rounded-[3px] px-1 py-[1px] not-italic"
						style={{ background: "oklch(0.94 0.04 50)" }}
					>
						10 ans de mariage
					</span>{" "}
					à La Maison Pléiade — quel honneur. Sébastien sera touché de relire
					votre message ; il dira à l'équipe que le moment partagé comptait
					aussi beaucoup…
				</div>
				<div className="flex gap-1.5">
					<Button variant="ghost" size="sm">
						Ajuster
					</Button>
					<Button
						variant="accent"
						size="sm"
						icon={<Check size={14} strokeWidth={1.75} />}
						className="ml-auto"
					>
						Publier sur Google
					</Button>
				</div>
			</div>
		</div>
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
		<div id="demo" className="relative mt-[72px] scroll-mt-24">
			<Card
				padding={0}
				className="overflow-hidden rounded-[20px] shadow-[var(--shadow-lg)]"
			>
				<div className="grid min-h-[420px] grid-cols-1 bg-paper md:grid-cols-[200px_1fr_1fr] lg:grid-cols-[240px_1fr_1fr]">
					{/* Sidebar mock */}
					<div className="border-line-soft border-b bg-bg-deep p-5 md:border-r md:border-b-0">
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
					<div className="border-line-soft border-b p-5 md:border-r md:border-b-0">
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
