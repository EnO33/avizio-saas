import { Clock } from "lucide-react";
import { Card } from "#/components/ui/card";

type Props = {
	/** Id d'ancre — matché par le sub-nav sticky IntersectionObserver. */
	readonly id: string;
	readonly title: string;
	readonly description: string;
};

/**
 * Section placeholder pour les rubriques pas encore implémentées (Équipe,
 * Facturation). On réserve la place dans le sub-nav + scroll pour que
 * l'emplacement final soit visible dès aujourd'hui — évite de déplacer
 * les ancres quand on branche la feature plus tard.
 */
export function ComingSoonSection({ id, title, description }: Props) {
	return (
		<section id={id} data-settings-section>
			<Card padding={24} className="border-dashed">
				<div className="mb-1 flex items-center gap-2">
					<Clock
						size={16}
						strokeWidth={1.75}
						aria-hidden="true"
						className="text-ink-mute"
					/>
					<h2 className="m-0 font-serif font-normal text-[22px]">{title}</h2>
				</div>
				<p className="m-0 text-[13px] text-ink-mute leading-[1.55]">
					{description}
				</p>
			</Card>
		</section>
	);
}
