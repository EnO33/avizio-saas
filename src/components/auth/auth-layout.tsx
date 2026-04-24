import type { ReactNode } from "react";
import { Logo } from "#/components/ui/logo";

export type AuthMode = "sign-in" | "sign-up" | "forgot-password";

type Props = {
	readonly mode: AuthMode;
	/** Kicker mono au-dessus du titre droit. Ex. « SE CONNECTER ». */
	readonly kicker: string;
	/** Titre serif 40px du panneau droit. Peut contenir une portion italique terracotta via ReactNode. */
	readonly heading: ReactNode;
	/** Sous-titre ink-soft sous le titre droit. */
	readonly subtitle: string;
	readonly children: ReactNode;
	/** Zone texte + lien en bas du panneau droit. */
	readonly footer?: ReactNode;
};

/**
 * Layout split 360/1fr partagé par /sign-in, /sign-up et /forgot-password.
 * Le panneau gauche (bg-deep) porte une accroche éditoriale serif dont
 * le contenu dépend du mode — chaque page traverse le même squelette
 * mais lit ici son intro. Le panneau droit accueille le formulaire via
 * `children`, avec kicker + titre + sous-titre passés en props.
 *
 * Hidden sidebar en < 920px (via `.hide-md-down`), le formulaire droit
 * prend alors toute la largeur — responsive sans media query custom.
 */
export function AuthLayout({
	mode,
	kicker,
	heading,
	subtitle,
	children,
	footer,
}: Props) {
	return (
		<div className="flex min-h-screen bg-bg">
			<LeftPanel mode={mode} />

			<div className="flex flex-1 items-center justify-center p-6 sm:p-10">
				<div key={mode} className="animate-fade-up w-full max-w-[420px]">
					<div className="mb-2.5 font-mono text-[11px] text-ink-mute uppercase tracking-[0.08em]">
						{kicker}
					</div>
					<h1 className="m-[0_0_10px] font-serif font-normal text-[30px] text-ink tracking-[-0.02em] leading-[1.05] sm:text-[40px]">
						{heading}
					</h1>
					<p className="mb-7 text-[14px] text-ink-soft">{subtitle}</p>

					{children}

					{footer ? (
						<div className="mt-7 flex justify-center gap-1.5 text-[13px] text-ink-mute">
							{footer}
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

function LeftPanel({ mode }: { mode: AuthMode }) {
	const content = LEFT_CONTENT[mode];
	return (
		<div
			className="hide-md-down flex flex-col justify-between border-line-soft border-r bg-bg-deep p-10"
			style={{ width: 360 }}
		>
			<Logo size={22} />
			<div>
				<div className="font-mono text-[11px] text-ink-mute uppercase tracking-[0.08em]">
					Avizio · 2026
				</div>
				<h2
					className="m-[10px_0_14px] font-serif font-normal text-ink tracking-[-0.02em] leading-[1.05]"
					style={{ fontSize: 40 }}
				>
					{content.heading}
				</h2>
				<p className="text-[13.5px] text-ink-soft leading-[1.55]">
					{content.paragraph}
				</p>
			</div>
			<div className="text-[11px] text-ink-mute">
				Besoin d'aide ?{" "}
				<a
					href="mailto:hello@avizio.fr"
					className="text-accent-ink hover:underline"
				>
					hello@avizio.fr
				</a>
			</div>
		</div>
	);
}

const LEFT_CONTENT: Record<
	AuthMode,
	{ heading: ReactNode; paragraph: string }
> = {
	"sign-in": {
		heading: (
			<>
				Vos avis.
				<br />
				<span className="text-accent-ink italic">Votre voix.</span>
			</>
		),
		paragraph:
			"Restaurateur, hôtelier, artisan — Avizio rédige pour vous, vous validez.",
	},
	"sign-up": {
		heading: (
			<>
				La confiance de vos clients,
				<br />
				<span className="text-accent-ink italic">
					en deux minutes par jour.
				</span>
			</>
		),
		paragraph:
			"Rejoignez les commerçants qui répondent à chaque avis — sans y passer leurs soirées.",
	},
	"forgot-password": {
		heading: (
			<>
				Ça arrive à
				<br />
				<span className="text-accent-ink italic">tout le monde.</span>
			</>
		),
		paragraph:
			"Le code que nous envoyons expire dans 15 minutes. Vérifiez votre boîte de réception et vos spams.",
	},
};
