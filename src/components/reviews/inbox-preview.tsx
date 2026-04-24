import { Link } from "@tanstack/react-router";
import { AlertTriangle, Edit3, ExternalLink, Wand2 } from "lucide-react";
import { businessTypeLabel } from "#/components/establishments/business-types";
import { Avatar } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Divider } from "#/components/ui/divider";
import { PLATFORM_LABELS, PlatformIcon } from "#/components/ui/platform-icon";
import { Stars } from "#/components/ui/stars";
import { StatusBadge } from "#/components/ui/status-badge";
import { timeAgoFr } from "#/lib/dates";
import type { EstablishmentSummary } from "#/server/db/queries/establishments";
import type { ReviewSummary } from "#/server/db/queries/reviews";
import { getReviewInitials } from "./initials";

const TONE_LABELS: Record<EstablishmentSummary["defaultTone"], string> = {
	warm: "Chaleureux",
	professional: "Professionnel",
	direct: "Direct",
};

type Props = {
	readonly review: ReviewSummary;
	readonly establishment: EstablishmentSummary | null;
};

/**
 * Panneau de droite de l'inbox — détail d'un avis sélectionné. Les 3
 * actions (IA / manuelle / ignorer) routent directement vers
 * `/reviews/$id` qui porte le workspace de rédaction complet. On ne
 * duplique pas l'éditeur ici : l'inbox reste une vue de triage, le
 * travail de rédaction se fait dans la page dédiée.
 */
export function InboxPreview({ review, establishment }: Props) {
	const flagged = review.rating <= 2;
	const initials = getReviewInitials(review.authorName);

	return (
		<div className="mx-auto max-w-[780px] px-9 pt-7 pb-10">
			<div className="mb-[18px] flex items-center gap-2.5">
				<PlatformIcon platform={review.platform} size={18} />
				<span className="text-[12.5px] text-ink-soft">
					{PLATFORM_LABELS[review.platform]}
				</span>
				<span className="text-ink-mute">·</span>
				<span className="text-[12.5px] text-ink-soft">
					{review.establishmentName}
				</span>
				<span className="ml-auto">
					<StatusBadge status={review.status} />
				</span>
			</div>

			<div className="mb-6 flex items-start gap-4">
				<Avatar initial={initials} size={52} />
				<div className="flex-1">
					<div className="font-serif text-[26px] tracking-[-0.01em]">
						{review.authorName}
					</div>
					<div className="mt-1 flex items-center gap-2">
						<Stars value={review.rating} size={14} />
						<span className="text-[13px] text-ink-soft">{review.rating}/5</span>
						<span className="text-ink-mute">·</span>
						<span className="text-[12.5px] text-ink-mute">
							{timeAgoFr(review.publishedAt)}
						</span>
					</div>
				</div>
				<Button
					variant="outline"
					size="sm"
					icon={<ExternalLink size={14} strokeWidth={1.75} />}
				>
					Voir sur {PLATFORM_LABELS[review.platform]}
				</Button>
			</div>

			{/*
			  Citation — bg-deep + border-left terracotta + serif italique
			  pour séparer visuellement ce que le client a écrit vs ce
			  qu'on va rédiger en réponse. Le `whitespace-pre-wrap`
			  préserve les sauts de ligne des avis longs.
			*/}
			<div className="rounded-r-lg border-accent border-l-[3px] bg-bg-deep px-[22px] py-5 font-serif text-[18px] text-ink italic leading-[1.55]">
				<p className="whitespace-pre-wrap">« {review.content} »</p>
			</div>

			{flagged ? (
				<div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[oklch(0.88_0.04_25)] bg-[oklch(0.95_0.03_25)] px-4 py-3">
					<AlertTriangle
						size={16}
						strokeWidth={1.75}
						className="mt-px shrink-0 text-[oklch(0.5_0.12_25)]"
					/>
					<div className="text-[12.5px] text-[oklch(0.4_0.12_25)]">
						<strong>Note basse détectée.</strong> On recommande une réponse dans
						les 24 h pour limiter l'impact SEO.
					</div>
				</div>
			) : null}

			<Divider style={{ margin: "28px 0" }} />

			<div className="mb-6 flex gap-2.5">
				<Link to="/reviews/$id" params={{ id: review.id }}>
					<Button
						variant="accent"
						size="md"
						icon={<Wand2 size={14} strokeWidth={1.75} />}
					>
						Rédiger une réponse avec l'IA
					</Button>
				</Link>
				<Link to="/reviews/$id" params={{ id: review.id }}>
					<Button
						variant="outline"
						size="md"
						icon={<Edit3 size={14} strokeWidth={1.75} />}
					>
						Rédiger manuellement
					</Button>
				</Link>
				{/*
				  « Ignorer » : action côté serveur qui passe le status à
				  `skipped`. Server fn à venir — pour l'instant le bouton
				  est visuel uniquement. On n'a pas envie de cacher l'action
				  de la maquette (mauvaise découverte produit), on l'affiche
				  et on branchera dans une PR dédiée.
				*/}
				<Button variant="ghost" size="md" disabled>
					Ignorer
				</Button>
			</div>

			{establishment ? (
				<Card padding={18} tone="cream">
					<div className="mb-2.5 font-mono text-[11px] text-ink-mute uppercase tracking-[0.06em]">
						Contexte établissement
					</div>
					<div
						className="grid gap-4 text-[13px]"
						style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
					>
						<div>
							<div className="mb-0.5 text-[11.5px] text-ink-mute">Nom</div>
							<div className="font-medium">{establishment.name}</div>
							<div className="text-[12px] text-ink-soft">
								{businessTypeLabel(establishment.businessType)} à{" "}
								{establishment.city}
							</div>
						</div>
						<div>
							<div className="mb-0.5 text-[11.5px] text-ink-mute">
								Ton par défaut
							</div>
							<div className="font-medium">
								{TONE_LABELS[establishment.defaultTone]}
							</div>
						</div>
						<div>
							<div className="mb-0.5 text-[11.5px] text-ink-mute">
								Note globale
							</div>
							<div className="flex items-center gap-1.5 font-medium">
								<Stars value={5} size={12} />
								<span className="text-ink-mute">—</span>
							</div>
						</div>
					</div>
				</Card>
			) : null}
		</div>
	);
}
