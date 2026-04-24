import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { ChoiceCard } from "#/components/ui/choice-card";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import { Toggle } from "#/components/ui/toggle";
import type {
	BusinessType,
	EstablishmentSummary,
	Tone,
} from "#/server/db/queries/establishments";
import { updateEstablishmentFn } from "#/server/fns/establishments";
import { BUSINESS_TYPE_OPTIONS, businessTypeLabel } from "./business-types";
import { DeleteEstablishmentButton } from "./delete-establishment-button";
import { GbpLinkPanel } from "./gbp-link-panel";
import { SettingsSubNav } from "./settings-sub-nav";

const BUSINESS_TYPE_VALUES = BUSINESS_TYPE_OPTIONS.map(
	(o) => o.value,
) as unknown as readonly [BusinessType, ...BusinessType[]];

const TONE_OPTIONS: ReadonlyArray<{
	readonly value: Tone;
	readonly label: string;
	readonly subtitle: string;
	readonly previewSentence: string;
}> = [
	{
		value: "warm",
		label: "Chaleureux",
		subtitle: "Proche, personnel",
		previewSentence:
			"« Chère Sophie, merci de ce gentil mot — ça fait plaisir à toute l'équipe. À très vite au comptoir ! »",
	},
	{
		value: "professional",
		label: "Professionnel",
		subtitle: "Courtois, mesuré",
		previewSentence:
			"« Chère Madame, nous vous remercions pour votre retour. Toute l'équipe prend note de vos commentaires. »",
	},
	{
		value: "direct",
		label: "Direct",
		subtitle: "Concis, factuel",
		previewSentence:
			"« Merci Sophie. Bien noté pour le café — on ajuste. À bientôt. »",
	},
];

const BRAND_CONTEXT_MAX = 5000;

const formSchema = z.object({
	name: z.string().trim().min(1, "Nom requis").max(100),
	city: z.string().trim().min(1, "Ville requise").max(100),
	postalCode: z.string().trim().max(20, "Code postal trop long"),
	businessType: z.enum(BUSINESS_TYPE_VALUES),
	languageCode: z
		.string()
		.regex(/^[a-z]{2}$/, "Code langue sur 2 lettres (ex. fr)"),
	defaultTone: z.enum(["warm", "professional", "direct"] as const),
	brandContext: z
		.string()
		.max(
			BRAND_CONTEXT_MAX,
			`Contexte trop long (${BRAND_CONTEXT_MAX} caractères max)`,
		),
	// Préférences de notification — stubbées côté DB pour l'instant,
	// le form les porte pour que l'UX soit prête quand on ajoutera
	// les colonnes correspondantes.
	lowRatingAlert: z.boolean(),
	lowRatingThreshold: z.number().int().min(1).max(4),
	weeklyDigest: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

// « Équipe » et « Facturation » ont déménagé dans `/settings` (org-level) —
// cf. ADR : les memberships Clerk sont attachés à l'org, pas à un
// établissement individuel. Ce sub-nav ne liste plus que ce qui est
// vraiment per-étab.
const SUB_NAV_ITEMS = [
	{ id: "general", label: "Général" },
	{ id: "tone", label: "Ton & style" },
	{ id: "context", label: "Contexte marque" },
	{ id: "notifications", label: "Notifications" },
	{ id: "connexions", label: "Connexions" },
];

type Props = {
	readonly establishment: EstablishmentSummary;
};

/**
 * Page Paramètres per-établissement. Sub-nav sticky à gauche qui
 * anchor-scroll aux sections à droite. Un seul formulaire global RHF
 * qui regroupe identité + réglages IA + notifications (stubbées).
 * Le submit envoie tout d'un bloc à `updateEstablishmentFn` — le
 * server fn accepte des patches partiels, donc rien n'empêche de
 * n'envoyer qu'un sous-ensemble, mais un save global est plus simple
 * mentalement que « quel bouton sauve quoi ».
 */
export function EstablishmentSettings({ establishment }: Props) {
	const router = useRouter();
	const [savedAt, setSavedAt] = useState<Date | null>(null);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: establishment.name,
			city: establishment.city,
			postalCode: establishment.postalCode ?? "",
			businessType: establishment.businessType,
			languageCode: establishment.languageCode,
			defaultTone: establishment.defaultTone,
			brandContext: establishment.brandContext ?? "",
			lowRatingAlert: true,
			lowRatingThreshold: 3,
			weeklyDigest: true,
		},
	});

	const selectedTone = form.watch("defaultTone");
	const brandContextValue = form.watch("brandContext") ?? "";
	const rootError = form.formState.errors.root?.message;
	const isDirty = form.formState.isDirty;
	const isSubmitting = form.formState.isSubmitting;

	const handle = async (values: FormValues) => {
		form.clearErrors("root");
		const result = await updateEstablishmentFn({
			data: {
				id: establishment.id,
				name: values.name,
				city: values.city,
				postalCode: values.postalCode.length > 0 ? values.postalCode : null,
				businessType: values.businessType,
				languageCode: values.languageCode,
				defaultTone: values.defaultTone,
				brandContext:
					values.brandContext.length > 0 ? values.brandContext : null,
			},
		});

		if (result.kind === "ok") {
			form.reset(values);
			setSavedAt(new Date());
			await router.invalidate();
			return;
		}
		form.setError("root", {
			message:
				result.kind === "unauthenticated"
					? "Ta session a expiré. Reconnecte-toi pour enregistrer."
					: result.kind === "not_found"
						? "Cet établissement n'existe plus."
						: "Impossible d'enregistrer. Réessaie dans un instant.",
		});
	};

	const onCancel = () => {
		form.reset();
	};

	return (
		<form
			onSubmit={form.handleSubmit(handle)}
			className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 md:px-10 md:py-8"
			noValidate
		>
			<div className="mb-6 md:mb-8">
				<div className="font-mono text-[12px] text-ink-mute uppercase tracking-[0.08em]">
					Établissement
				</div>
				<h1 className="m-[4px_0_4px] font-serif font-normal text-[30px] text-ink tracking-[-0.02em] sm:text-[40px]">
					{establishment.name}
				</h1>
				<p className="m-0 text-[14px] text-ink-soft">
					{businessTypeLabel(establishment.businessType)} · {establishment.city}
				</p>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr] lg:gap-10">
				<SettingsSubNav
					items={SUB_NAV_ITEMS}
					sectionSelector="section[data-settings-section]"
				/>

				<div className="flex flex-col gap-6">
					<GeneralSection form={form} />
					<ToneSection form={form} selectedTone={selectedTone} />
					<ContextSection
						form={form}
						brandContextLength={brandContextValue.length}
					/>
					<NotificationsSection form={form} />
					<ConnectionsSection establishment={establishment} />
					<DangerSection
						establishmentId={establishment.id}
						establishmentName={establishment.name}
					/>

					{rootError ? (
						<p className="rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[13px] text-[oklch(0.4_0.12_25)]">
							{rootError}
						</p>
					) : null}

					<div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-end">
						{savedAt && !isDirty ? (
							<span className="text-[12px] text-green sm:self-center">
								Enregistré ✓
							</span>
						) : null}
						<Button
							variant="ghost"
							size="md"
							onClick={onCancel}
							disabled={!isDirty || isSubmitting}
							type="button"
						>
							Annuler
						</Button>
						<Button
							variant="accent"
							size="md"
							icon={<Check size={14} strokeWidth={1.75} />}
							disabled={!isDirty || isSubmitting}
							type="submit"
						>
							{isSubmitting
								? "Enregistrement…"
								: "Enregistrer les modifications"}
						</Button>
					</div>
				</div>
			</div>
		</form>
	);
}

type FormProp = { readonly form: ReturnType<typeof useForm<FormValues>> };

function GeneralSection({ form }: FormProp) {
	return (
		<section id="general" data-settings-section>
			<Card padding={24}>
				<h2 className="mb-1 font-serif font-normal text-[22px]">
					Informations générales
				</h2>
				<p className="mb-5 text-[13px] text-ink-mute">
					Nom, adresse et type d'activité. Utilisés dans toutes les réponses
					générées.
				</p>
				<div className="flex flex-col gap-4">
					<Field label="Nom de l'établissement">
						<Input {...form.register("name")} />
						{form.formState.errors.name?.message ? (
							<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
								{form.formState.errors.name.message}
							</p>
						) : null}
					</Field>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
						<Field label="Ville">
							<Input {...form.register("city")} />
							{form.formState.errors.city?.message ? (
								<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
									{form.formState.errors.city.message}
								</p>
							) : null}
						</Field>
						<Field label="Code postal">
							<Input {...form.register("postalCode")} />
							{form.formState.errors.postalCode?.message ? (
								<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
									{form.formState.errors.postalCode.message}
								</p>
							) : null}
						</Field>
					</div>
					<Field label="Type d'activité">
						<div className="flex flex-wrap gap-1.5">
							{BUSINESS_TYPE_OPTIONS.map((opt) => (
								<BusinessTypePill
									key={opt.value}
									value={opt.value}
									label={opt.label}
									active={form.watch("businessType") === opt.value}
									onSelect={() =>
										form.setValue("businessType", opt.value, {
											shouldDirty: true,
										})
									}
								/>
							))}
						</div>
					</Field>
					<Field
						label="Langue des réponses"
						help="Le ton et la formule seront adaptés à la langue choisie."
					>
						<Input {...form.register("languageCode")} placeholder="fr" />
						{form.formState.errors.languageCode?.message ? (
							<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
								{form.formState.errors.languageCode.message}
							</p>
						) : null}
					</Field>
				</div>
			</Card>
		</section>
	);
}

function BusinessTypePill({
	value: _value,
	label,
	active,
	onSelect,
}: {
	value: BusinessType;
	label: string;
	active: boolean;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			aria-pressed={active}
			className={[
				"rounded-full border px-3 py-1.5 font-medium text-[12.5px] transition-colors",
				active
					? "border-accent bg-accent-soft text-accent-ink"
					: "border-line bg-paper text-ink-soft hover:text-ink",
			].join(" ")}
		>
			{label}
		</button>
	);
}

function ToneSection({
	form,
	selectedTone,
}: FormProp & { selectedTone: Tone }) {
	const tone = TONE_OPTIONS.find((t) => t.value === selectedTone);
	return (
		<section id="tone" data-settings-section>
			<Card padding={24}>
				<h2 className="mb-1 font-serif font-normal text-[22px]">
					Ton par défaut
				</h2>
				<p className="mb-[18px] text-[13px] text-ink-mute">
					Appliqué à toutes les réponses de cet établissement. Vous pourrez le
					changer pour chaque avis.
				</p>
				<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
					{TONE_OPTIONS.map((opt) => (
						<ChoiceCard
							key={opt.value}
							label={opt.label}
							sub={opt.subtitle}
							active={selectedTone === opt.value}
							onClick={() =>
								form.setValue("defaultTone", opt.value, { shouldDirty: true })
							}
						/>
					))}
				</div>
				{tone ? (
					<div className="mt-5 rounded-lg border-accent border-l-[3px] bg-bg-deep p-4">
						<div className="mb-1.5 font-mono text-[11px] text-ink-mute uppercase tracking-[0.06em]">
							Aperçu · ton {tone.label.toLowerCase()}
						</div>
						<div className="font-serif text-[15px] italic leading-[1.5]">
							{tone.previewSentence}
						</div>
					</div>
				) : null}
			</Card>
		</section>
	);
}

function ContextSection({
	form,
	brandContextLength,
}: FormProp & { brandContextLength: number }) {
	return (
		<section id="context" data-settings-section>
			<Card padding={24}>
				<h2 className="mb-1 font-serif font-normal text-[22px]">
					Contexte de marque
				</h2>
				<p className="mb-3.5 text-[13px] text-ink-mute">
					Injecté dans chaque prompt. Parlez à l'IA comme à un nouveau serveur
					qui découvre votre maison.
				</p>
				<Textarea
					{...form.register("brandContext")}
					rows={8}
					maxLength={BRAND_CONTEXT_MAX}
					placeholder={`Ex : Restaurant de cuisine contemporaine, ouvert en 2018.\nChef : Sébastien Lenoir.\nSigner "L'équipe de La Maison Pléiade".\nNe jamais mentionner : nos anciens associés.`}
				/>
				<div className="mt-2 flex items-center justify-between">
					<div className="flex flex-wrap gap-1.5">
						{[
							"Équipe & prénoms",
							"Spécialités",
							"À ne pas mentionner",
							"Formule de signature",
						].map((cat) => (
							<Badge key={cat} tone="neutral">
								{cat}
							</Badge>
						))}
					</div>
					<span className="text-[11px] text-ink-mute">
						{brandContextLength} / {BRAND_CONTEXT_MAX}
					</span>
				</div>
			</Card>
		</section>
	);
}

function NotificationsSection({ form }: FormProp) {
	const lowRatingAlert = form.watch("lowRatingAlert");
	const lowRatingThreshold = form.watch("lowRatingThreshold");
	const weeklyDigest = form.watch("weeklyDigest");

	return (
		<section id="notifications" data-settings-section>
			<Card padding={24}>
				<h2 className="mb-5 font-serif font-normal text-[22px]">
					Notifications
				</h2>
				<p className="-mt-4 mb-3 text-[12px] text-ink-mute italic">
					Aperçu du futur — ces préférences ne sont pas encore branchées au
					backend. Ajustez-les librement, on les persistera quand les
					notifications seront activées.
				</p>

				<div className="flex items-center justify-between border-line-soft border-b py-3">
					<div>
						<div className="font-medium text-[13.5px]">Alerte note basse</div>
						<div className="mt-0.5 text-[12px] text-ink-mute">
							Email immédiat à {lowRatingThreshold} étoiles ou moins.
						</div>
					</div>
					<Toggle
						on={lowRatingAlert}
						onChange={(next) =>
							form.setValue("lowRatingAlert", next, { shouldDirty: true })
						}
						ariaLabel="Activer les alertes note basse"
					/>
				</div>

				<div className="flex items-center justify-between border-line-soft border-b py-3">
					<div>
						<div className="font-medium text-[13.5px]">Seuil</div>
						<div className="mt-0.5 text-[12px] text-ink-mute">
							Déclenche l'alerte si la note est ≤
						</div>
					</div>
					<div className="flex gap-1">
						{[1, 2, 3, 4].map((n) => (
							<button
								key={n}
								type="button"
								onClick={() =>
									form.setValue("lowRatingThreshold", n, {
										shouldDirty: true,
									})
								}
								aria-pressed={lowRatingThreshold === n}
								className={[
									"size-8 rounded-md border font-medium text-[13px]",
									lowRatingThreshold === n
										? "border-accent bg-accent-soft text-accent-ink"
										: "border-line bg-paper text-ink-soft",
								].join(" ")}
							>
								{n}★
							</button>
						))}
					</div>
				</div>

				<div className="flex items-center justify-between py-3">
					<div>
						<div className="font-medium text-[13.5px]">
							Récapitulatif hebdomadaire
						</div>
						<div className="mt-0.5 text-[12px] text-ink-mute">
							Lundi matin · note, volume, suggestions.
						</div>
					</div>
					<Toggle
						on={weeklyDigest}
						onChange={(next) =>
							form.setValue("weeklyDigest", next, { shouldDirty: true })
						}
						ariaLabel="Activer le récapitulatif hebdomadaire"
					/>
				</div>
			</Card>
		</section>
	);
}

function ConnectionsSection({
	establishment,
}: {
	establishment: EstablishmentSummary;
}) {
	return (
		<section id="connexions" data-settings-section>
			<Card padding={24}>
				<h2 className="mb-1 font-serif font-normal text-[22px]">Connexions</h2>
				<p className="mb-4 text-[13px] text-ink-mute">
					Liez cet établissement à sa fiche Google Business Profile pour
					synchroniser automatiquement les avis.
				</p>
				<GbpLinkPanel establishment={establishment} />
			</Card>
		</section>
	);
}

function DangerSection({
	establishmentId,
	establishmentName,
}: {
	establishmentId: string;
	establishmentName: string;
}) {
	return (
		<section id="danger">
			<Card
				padding={24}
				className="border-[oklch(0.88_0.04_25)] bg-[oklch(0.98_0.01_25)]"
			>
				<h2 className="mb-1 font-serif font-normal text-[22px] text-[oklch(0.4_0.12_25)]">
					Zone dangereuse
				</h2>
				<p className="mb-4 text-[13px] text-[oklch(0.45_0.12_25)]">
					Supprimer cet établissement efface aussi tous ses avis et réponses
					liés. Action irréversible.
				</p>
				<DeleteEstablishmentButton
					establishmentId={establishmentId}
					establishmentName={establishmentName}
				/>
			</Card>
		</section>
	);
}
