import { useOrganization, useUser } from "@clerk/tanstack-react-start";
import { SettingsSubNav } from "#/components/establishments/settings-sub-nav";
import { AccountSection } from "./account-section";
import { ComingSoonSection } from "./coming-soon-section";
import { OrganizationSection } from "./organization-section";
import { TeamSection } from "./team-section";

const SUB_NAV_ITEMS = [
	{ id: "organization", label: "Organisation" },
	{ id: "team", label: "Équipe" },
	{ id: "billing", label: "Facturation" },
	{ id: "account", label: "Mon compte" },
] as const;

/**
 * Page `/settings` — regroupe tout ce qui est org-level et user-level :
 * identité de l'organisation, membres, abonnement Stripe, profil user.
 *
 * Réutilise la trame visuelle de `establishment-settings.tsx` (sub-nav
 * IntersectionObserver sticky à gauche, sections en cards à droite)
 * pour que la navigation reste cohérente entre les deux écrans — l'user
 * sait qu'il est « dans les paramètres » et pas dans une nouvelle trame.
 */
export function SettingsPage() {
	const { organization } = useOrganization();
	const { user } = useUser();

	if (!organization || !user) {
		// _authed.beforeLoad redirige vers /onboarding si !orgId et
		// ensureSignedIn garantit un user. Ce fallback couvre le premier
		// paint pendant que Clerk hydrate les hooks côté client.
		return null;
	}

	return (
		<div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 md:px-10 md:py-8">
			<div className="mb-6 md:mb-8">
				<div className="font-mono text-[12px] text-ink-mute uppercase tracking-[0.08em]">
					Paramètres
				</div>
				<h1 className="m-[4px_0_4px] font-serif font-normal text-[30px] text-ink tracking-[-0.02em] sm:text-[40px]">
					{organization.name}
				</h1>
				<p className="m-0 text-[14px] text-ink-soft">
					Organisation · {user.primaryEmailAddress?.emailAddress ?? user.id}
				</p>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr] lg:gap-10">
				<SettingsSubNav
					items={SUB_NAV_ITEMS}
					sectionSelector="section[data-settings-section]"
				/>

				<div className="flex flex-col gap-6">
					<OrganizationSection />
					<TeamSection />
					<ComingSoonSection
						id="billing"
						title="Facturation"
						description="Plan, prochain renouvellement et historique des factures via Stripe. L'intégration arrive avec la sortie publique."
					/>
					<AccountSection />
				</div>
			</div>
		</div>
	);
}
