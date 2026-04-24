import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

type Props = {
	readonly children: ReactNode;
	/** Nombre d'avis à traiter — passé au badge sidebar + dot topbar. */
	readonly pendingReviewsCount: number;
	/** Jours restants sur l'essai gratuit. `null` = pas d'essai actif. */
	readonly trialDaysRemaining: number | null;
};

/**
 * Conteneur authenticated : grid sidebar (232px fixe) + main flex. La
 * sidebar et la topbar sont sticky de leur côté — le contenu scroll
 * indépendamment, ce qui est nécessaire pour les vues deux-panneaux
 * (inbox, workspace de réponse) qui gèrent leur propre overflow.
 */
export function Shell({
	children,
	pendingReviewsCount,
	trialDaysRemaining,
}: Props) {
	return (
		<div className="grid min-h-screen grid-cols-[232px_1fr] bg-bg">
			<Sidebar
				pendingReviewsCount={pendingReviewsCount}
				trialDaysRemaining={trialDaysRemaining}
			/>
			<main className="flex min-w-0 flex-col">
				<Topbar hasNotifications={pendingReviewsCount > 0} />
				<div className="flex-1">{children}</div>
			</main>
		</div>
	);
}
