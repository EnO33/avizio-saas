import type { ReactNode } from "react";
import { BottomNav } from "./bottom-nav";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

type Props = {
	readonly children: ReactNode;
	/** Nombre d'avis à traiter — passé au badge sidebar + dot topbar + bottom-nav. */
	readonly pendingReviewsCount: number;
	/** Jours restants sur l'essai gratuit. `null` = pas d'essai actif. */
	readonly trialDaysRemaining: number | null;
	/** Nombre d'établissements dans l'org active — affiché dans la meta du switcher. */
	readonly establishmentsCount: number;
};

/**
 * Conteneur authenticated : en desktop (`md:` et +), grid sidebar (232px fixe)
 * + main flex. En mobile, la sidebar est cachée et remplacée par une
 * `BottomNav` sticky en bas d'écran. La sidebar et la topbar sont sticky de
 * leur côté — le contenu scroll indépendamment, ce qui est nécessaire pour
 * les vues deux-panneaux (inbox, workspace de réponse) qui gèrent leur
 * propre overflow.
 */
export function Shell({
	children,
	pendingReviewsCount,
	trialDaysRemaining,
	establishmentsCount,
}: Props) {
	return (
		<div className="grid min-h-screen grid-cols-1 bg-bg md:grid-cols-[232px_1fr]">
			<Sidebar
				pendingReviewsCount={pendingReviewsCount}
				trialDaysRemaining={trialDaysRemaining}
				establishmentsCount={establishmentsCount}
			/>
			<main className="flex min-w-0 flex-col">
				<Topbar hasNotifications={pendingReviewsCount > 0} />
				<div className="flex-1 pb-16 md:pb-0">{children}</div>
				<BottomNav pendingReviewsCount={pendingReviewsCount} />
			</main>
		</div>
	);
}
