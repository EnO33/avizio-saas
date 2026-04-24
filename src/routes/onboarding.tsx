import {
	useOrganization,
	useOrganizationList,
} from "@clerk/tanstack-react-start";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { ChoiceCard } from "#/components/ui/choice-card";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Logo } from "#/components/ui/logo";
import { PLATFORM_LABELS, PlatformIcon } from "#/components/ui/platform-icon";
import type { BusinessType, Tone } from "#/server/db/queries/establishments";
import { ensureSignedIn } from "#/server/fns/auth-guards";
import { createEstablishmentFn } from "#/server/fns/establishments";
import { startGoogleConnect } from "#/server/fns/oauth-google";

/*
  Route en dehors de `_authed` parce que le Shell (sidebar + topbar)
  n'a rien à voir ici — l'onboarding a son propre split 360/1fr, la
  sidebar casserait le rythme visuel. On garde quand même un guard
  `ensureSignedIn` pour que le flux soit cohérent : on arrive ici après
  sign-up, jamais depuis l'extérieur.
*/
export const Route = createFileRoute("/onboarding")({
	beforeLoad: async () => ensureSignedIn(),
	component: OnboardingPage,
});

type Role = "owner" | "manager";

const ROLE_OPTIONS: ReadonlyArray<{
	readonly value: Role;
	readonly label: string;
}> = [
	{ value: "owner", label: "Propriétaire" },
	{ value: "manager", label: "Manager" },
];

const BUSINESS_TYPE_OPTIONS: ReadonlyArray<{
	readonly value: BusinessType;
	readonly label: string;
}> = [
	{ value: "restaurant", label: "Restaurant" },
	{ value: "hotel", label: "Hôtel" },
	{ value: "cafe", label: "Café" },
	{ value: "bar", label: "Bar" },
	{ value: "bakery", label: "Boulangerie" },
	{ value: "artisan", label: "Artisan" },
	{ value: "retail", label: "Commerce" },
];

const TONE_OPTIONS: ReadonlyArray<{
	readonly value: Tone;
	readonly label: string;
	readonly subtitle: string;
}> = [
	{ value: "warm", label: "Chaleureux", subtitle: "Proche, personnel" },
	{
		value: "professional",
		label: "Professionnel",
		subtitle: "Courtois, mesuré",
	},
	{ value: "direct", label: "Direct", subtitle: "Concis, factuel" },
];

const STEPS = [
	{ title: "Créer votre espace", subtitle: "Un espace par entreprise." },
	{
		title: "Votre premier établissement",
		subtitle: "Vous pourrez en ajouter d'autres plus tard.",
	},
	{
		title: "Connecter Google Business",
		subtitle: "Un clic. On récupère vos avis.",
	},
] as const;

function OnboardingPage() {
	const navigate = useNavigate();
	const orgList = useOrganizationList({ userMemberships: true });
	const { createOrganization, setActive, userMemberships, isLoaded } = orgList;
	const { organization: activeOrg } = useOrganization();

	/*
	  Edge case — l'utilisateur a une membership mais pas d'org active
	  (changement d'appareil, race OAuth qui a buggé le setActive). Le
	  guard `_authed.beforeLoad` l'a redirigé ici parce que `session.orgId`
	  est null, mais il a déjà une org côté Clerk. On active la première
	  membership et on repart sur /dashboard sans passer par les 3 étapes.

	  Le `attemptedRef` empêche les double-runs sous React 19 strict mode.
	*/
	const autoActivateAttempted = useRef(false);
	useEffect(() => {
		if (!isLoaded) return;
		if (userMemberships.isLoading) return;
		if (autoActivateAttempted.current) return;
		const memberships = userMemberships.data ?? [];
		if (memberships.length === 0) return;
		if (!setActive) return;
		autoActivateAttempted.current = true;
		const first = memberships[0];
		if (!first) return;
		void setActive({ organization: first.organization.id }).then(() => {
			window.location.href = "/dashboard";
		});
	}, [isLoaded, userMemberships.isLoading, userMemberships.data, setActive]);

	const [step, setStep] = useState<0 | 1 | 2>(0);
	// On garde la trace du plus haut step qui a eu son action backend
	// commise (org créée, établissement créé). Les formulaires des
	// étapes déjà commises passent en read-only — l'utilisateur peut
	// revoir ses choix mais pas les changer sans repartir à zéro.
	const [committedUpTo, setCommittedUpTo] = useState<-1 | 0 | 1 | 2>(-1);

	const [orgName, setOrgName] = useState<string>(activeOrg?.name ?? "");
	const [role, setRole] = useState<Role>("owner");

	const [estName, setEstName] = useState<string>("");
	const [estCity, setEstCity] = useState<string>("");
	const [estType, setEstType] = useState<BusinessType>("restaurant");
	const [estTone, setEstTone] = useState<Tone>("warm");

	const [busy, setBusy] = useState<"next" | "google" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const commitStep0 = async (): Promise<boolean> => {
		setError(null);
		if (orgName.trim().length === 0) {
			setError("Le nom de l'entreprise est requis.");
			return false;
		}
		// Idempotent : si l'utilisateur a déjà une org active (ex. revenu
		// ici après une création précédente, ou flow Clerk qui a auto-créé
		// une org), on ne recrée pas — on passe au step suivant directement.
		if (activeOrg) {
			setCommittedUpTo(0);
			return true;
		}
		if (!createOrganization || !setActive) {
			setError("Chargement de Clerk en cours, réessayez dans un instant.");
			return false;
		}
		const created = await createOrganization({ name: orgName.trim() });
		await setActive({ organization: created.id });
		setCommittedUpTo(0);
		return true;
	};

	const commitStep1 = async (): Promise<boolean> => {
		setError(null);
		if (estName.trim().length === 0 || estCity.trim().length === 0) {
			setError("Nom et ville sont requis.");
			return false;
		}
		const result = await createEstablishmentFn({
			data: {
				name: estName.trim(),
				city: estCity.trim(),
				postalCode: null,
				businessType: estType,
				languageCode: "fr",
				defaultTone: estTone,
			},
		});
		if (result.kind === "ok") {
			setCommittedUpTo(1);
			return true;
		}
		setError(
			result.kind === "unauthenticated"
				? "Ta session a expiré. Reconnecte-toi."
				: "Impossible de créer l'établissement. Réessaie.",
		);
		return false;
	};

	const onNext = async () => {
		setBusy("next");
		let ok = true;
		if (step === 0 && committedUpTo < 0) ok = await commitStep0();
		else if (step === 1 && committedUpTo < 1) ok = await commitStep1();
		setBusy(null);
		if (!ok) return;
		if (step < 2) setStep((step + 1) as 0 | 1 | 2);
		else await navigate({ to: "/dashboard" });
	};

	const onBack = () => {
		if (step === 0) void navigate({ to: "/" });
		else setStep((step - 1) as 0 | 1);
	};

	const onGoogleConnect = async () => {
		setBusy("google");
		const { url } = await startGoogleConnect();
		window.location.href = url;
	};

	const onSkipGoogle = async () => {
		await navigate({ to: "/dashboard" });
	};

	return (
		<div className="flex min-h-screen bg-bg">
			<LeftPanel step={step} />

			<div className="flex flex-1 items-center justify-center p-6 sm:p-10">
				<div key={step} className="animate-fade-up w-full max-w-[480px]">
					<div className="mb-2.5 font-mono text-[12px] text-ink-mute">
						{String(step + 1).padStart(2, "0")} / 03
					</div>
					<h1 className="m-[0_0_12px] font-serif font-normal text-[32px] text-ink tracking-[-0.02em] leading-[1.05] sm:text-[44px]">
						{STEPS[step].title}
					</h1>
					<p className="mb-8 text-[15px] text-ink-soft">
						{STEPS[step].subtitle}
					</p>

					{step === 0 ? (
						<Step0
							orgName={orgName}
							onOrgName={setOrgName}
							role={role}
							onRole={setRole}
							locked={committedUpTo >= 0}
						/>
					) : step === 1 ? (
						<Step1
							estName={estName}
							onEstName={setEstName}
							estCity={estCity}
							onEstCity={setEstCity}
							estType={estType}
							onEstType={setEstType}
							estTone={estTone}
							onEstTone={setEstTone}
							locked={committedUpTo >= 1}
						/>
					) : (
						<Step2
							onConnect={onGoogleConnect}
							onSkip={onSkipGoogle}
							busy={busy === "google"}
						/>
					)}

					{error ? (
						<p className="mt-4 rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[13px] text-[oklch(0.4_0.12_25)]">
							{error}
						</p>
					) : null}

					{step !== 2 ? (
						<div className="mt-10 flex items-center justify-between">
							<Button
								variant="ghost"
								size="md"
								icon={<ArrowLeft size={14} strokeWidth={1.75} />}
								onClick={onBack}
								disabled={busy !== null}
							>
								{step === 0 ? "Retour à l'accueil" : "Précédent"}
							</Button>
							<Button
								variant="accent"
								size="md"
								iconRight={<ArrowRight size={14} strokeWidth={1.75} />}
								onClick={() => void onNext()}
								disabled={busy !== null}
							>
								{busy === "next" ? "En cours…" : "Continuer"}
							</Button>
						</div>
					) : null}
				</div>
			</div>
		</div>
	);
}

function LeftPanel({ step }: { step: 0 | 1 | 2 }) {
	return (
		<div
			className="hide-md-down flex flex-col justify-between border-line-soft border-r bg-bg-deep p-10"
			style={{ width: 360 }}
		>
			<Logo size={22} />
			<div>
				<h2
					className="m-[0_0_8px] font-serif font-normal text-ink tracking-[-0.02em] leading-[1.05]"
					style={{ fontSize: 36 }}
				>
					Bienvenue.
				</h2>
				<p className="mb-10 text-[14px] text-ink-soft">
					En 3 minutes, vos avis sont synchronisés et prêts à être traités.
				</p>
				<ol className="m-0 flex list-none flex-col gap-[18px] p-0">
					{STEPS.map((s, i) => (
						<StepIndicator
							key={s.title}
							index={i}
							label={s.title}
							subtitle={s.subtitle}
							state={i < step ? "done" : i === step ? "active" : "pending"}
						/>
					))}
				</ol>
			</div>
			<div className="text-[11px] text-ink-mute">
				Des questions ?{" "}
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

type IndicatorState = "done" | "active" | "pending";

function StepIndicator({
	index,
	label,
	subtitle,
	state,
}: {
	index: number;
	label: string;
	subtitle: string;
	state: IndicatorState;
}) {
	const circleClasses =
		state === "done"
			? "border-accent bg-accent text-bg"
			: state === "active"
				? "border-accent bg-paper text-accent-ink"
				: "border-line bg-paper text-ink-mute";
	const dimmed = state === "pending" ? "opacity-40" : "opacity-100";
	return (
		<li className={`flex items-start gap-3.5 transition-opacity ${dimmed}`}>
			<div
				className={`flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] font-serif font-semibold text-[12px] ${circleClasses}`}
			>
				{state === "done" ? <Check size={14} strokeWidth={2} /> : index + 1}
			</div>
			<div>
				<div className="font-medium text-[14px] text-ink">{label}</div>
				<div className="mt-0.5 text-[12px] text-ink-mute">{subtitle}</div>
			</div>
		</li>
	);
}

function Step0({
	orgName,
	onOrgName,
	role,
	onRole,
	locked,
}: {
	orgName: string;
	onOrgName: (v: string) => void;
	role: Role;
	onRole: (v: Role) => void;
	locked: boolean;
}) {
	return (
		<div className="flex flex-col gap-4">
			<Field label="Nom de votre entreprise">
				<Input
					value={orgName}
					onChange={(e) => onOrgName(e.target.value)}
					placeholder="Ex. La Maison Pléiade"
					disabled={locked}
				/>
			</Field>
			<Field label="Votre rôle" help="On ajustera l'interface en conséquence.">
				<div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
					{ROLE_OPTIONS.map((opt) => (
						<ChoiceCard
							key={opt.value}
							label={opt.label}
							active={role === opt.value}
							onClick={() => onRole(opt.value)}
							disabled={locked}
						/>
					))}
				</div>
			</Field>
		</div>
	);
}

function Step1({
	estName,
	onEstName,
	estCity,
	onEstCity,
	estType,
	onEstType,
	estTone,
	onEstTone,
	locked,
}: {
	estName: string;
	onEstName: (v: string) => void;
	estCity: string;
	onEstCity: (v: string) => void;
	estType: BusinessType;
	onEstType: (v: BusinessType) => void;
	estTone: Tone;
	onEstTone: (v: Tone) => void;
	locked: boolean;
}) {
	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
				<Field label="Nom de l'établissement">
					<Input
						value={estName}
						onChange={(e) => onEstName(e.target.value)}
						placeholder="La Maison Pléiade"
						disabled={locked}
					/>
				</Field>
				<Field label="Ville">
					<Input
						value={estCity}
						onChange={(e) => onEstCity(e.target.value)}
						placeholder="Lyon"
						disabled={locked}
					/>
				</Field>
			</div>
			<Field label="Type d'activité">
				<div className="flex flex-wrap gap-1.5">
					{BUSINESS_TYPE_OPTIONS.map((opt) => (
						<button
							key={opt.value}
							type="button"
							onClick={() => onEstType(opt.value)}
							aria-pressed={estType === opt.value}
							disabled={locked}
							className={[
								"rounded-full border px-3 py-1.5 font-medium text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-60",
								estType === opt.value
									? "border-accent bg-accent-soft text-accent-ink"
									: "border-line bg-paper text-ink-soft hover:text-ink",
							].join(" ")}
						>
							{opt.label}
						</button>
					))}
				</div>
			</Field>
			<Field
				label="Ton par défaut des réponses"
				help="Vous pourrez le changer à chaque avis."
			>
				<div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
					{TONE_OPTIONS.map((opt) => (
						<ChoiceCard
							key={opt.value}
							label={opt.label}
							sub={opt.subtitle}
							active={estTone === opt.value}
							onClick={() => onEstTone(opt.value)}
							disabled={locked}
						/>
					))}
				</div>
			</Field>
		</div>
	);
}

function Step2({
	onConnect,
	onSkip,
	busy,
}: {
	onConnect: () => void;
	onSkip: () => void;
	busy: boolean;
}) {
	return (
		<div>
			<Card padding={24} tone="cream">
				<div className="mb-5 flex items-center gap-3.5">
					<PlatformIcon platform="google" size={44} />
					<div>
						<div className="font-medium text-[15px]">
							{PLATFORM_LABELS.google} Business Profile
						</div>
						<div className="text-[12.5px] text-ink-mute">
							Récupération des avis et publication des réponses
						</div>
					</div>
				</div>
				<ul className="m-[0_0_20px] flex list-none flex-col gap-2.5 p-0">
					{[
						"Accès en lecture à vos avis",
						"Droit de publier vos réponses",
						"Aucune autre donnée collectée",
					].map((b) => (
						<li
							key={b}
							className="flex items-center gap-2 text-[13px] text-ink-soft"
						>
							<Check size={15} strokeWidth={1.75} /> {b}
						</li>
					))}
				</ul>
				<Button
					variant="primary"
					size="md"
					className="w-full"
					onClick={onConnect}
					disabled={busy}
				>
					{busy ? "Redirection vers Google…" : "Se connecter avec Google"}
				</Button>
			</Card>
			<div className="mt-4 flex gap-4">
				<button
					type="button"
					onClick={onSkip}
					className="cursor-pointer border-none bg-transparent p-0 text-[13px] text-ink-mute hover:text-ink-soft"
				>
					Passer cette étape et entrer dans Avizio →
				</button>
			</div>
		</div>
	);
}
