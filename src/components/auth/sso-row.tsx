import { PlatformIcon } from "#/components/ui/platform-icon";

type Props = {
	readonly label: string;
	readonly onClick: () => void;
	readonly disabled?: boolean;
};

/**
 * Bouton SSO Google + divider « OU » utilisés en tête des formulaires
 * d'auth. Extrait dans un seul composant parce que les 3 pages (sign-in,
 * sign-up, forgot n'a pas de SSO mais gardons-le à part pour cohérence)
 * répètent exactement le même bloc — un seul endroit à ajuster si on
 * ajoute d'autres providers.
 */
export function SsoRow({ label, onClick, disabled }: Props) {
	return (
		<>
			<button
				type="button"
				onClick={onClick}
				disabled={disabled}
				className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-line bg-paper px-3.5 py-2.5 font-medium text-[13.5px] text-ink transition-colors hover:bg-bg-deep disabled:cursor-not-allowed disabled:opacity-50"
			>
				<PlatformIcon platform="google" size={18} />
				{label}
			</button>
			<div className="my-5 flex items-center gap-2.5">
				<div className="h-px flex-1 bg-line-soft" />
				<span className="font-mono text-[11px] text-ink-mute tracking-[0.08em]">
					OU
				</span>
				<div className="h-px flex-1 bg-line-soft" />
			</div>
		</>
	);
}
