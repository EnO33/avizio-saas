import { Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "#/components/ui/button";
import { PLATFORM_LABELS } from "#/components/ui/platform-icon";
import type { ReviewSummary } from "#/server/db/queries/reviews";

type Props = {
	readonly review: ReviewSummary;
};

/**
 * Écran de confirmation post-approbation. La copie reste honnête —
 * on dit « Approuvé » et non « Publié » parce que notre server fn
 * `approveResponseFn` ne pousse pas encore sur la plateforme (en
 * attente de l'accès API Google). Le squelette du design est là, on
 * swap le verbe le jour où le vrai publish arrive.
 */
export function ResponseApprovedConfirm({ review }: Props) {
	const platformLabel = PLATFORM_LABELS[review.platform];
	return (
		<div className="animate-fade-up flex min-h-[calc(100vh-60px)] items-center justify-center bg-bg p-10">
			<div className="max-w-[560px] text-center">
				<div className="mx-auto mb-6 flex size-[72px] items-center justify-center rounded-full bg-green-soft text-green">
					<Check size={32} strokeWidth={2} />
				</div>
				<h1
					className="m-0 font-serif font-normal text-ink tracking-[-0.02em]"
					style={{ fontSize: 44 }}
				>
					Approuvé
					<span className="text-accent-ink italic"> pour {platformLabel}.</span>
				</h1>
				<p className="mt-3 text-[15px] text-ink-soft leading-[1.55]">
					Votre réponse à {review.authorName} est prête. Elle sera publiée dès
					que notre intégration {platformLabel} aura terminé la vérification
					finale.
				</p>
				<div className="mt-8 flex justify-center gap-2.5">
					<Link to="/reviews">
						<Button variant="outline" size="md">
							Avis suivant
						</Button>
					</Link>
					<Link to="/dashboard">
						<Button
							variant="accent"
							size="md"
							iconRight={<ArrowRight size={14} strokeWidth={1.75} />}
						>
							Retour au tableau de bord
						</Button>
					</Link>
				</div>
			</div>
		</div>
	);
}
