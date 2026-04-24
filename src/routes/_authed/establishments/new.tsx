import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BUSINESS_TYPE_OPTIONS } from "#/components/establishments/business-types";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { ChoiceCard } from "#/components/ui/choice-card";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import type { BusinessType, Tone } from "#/server/db/queries/establishments";
import { createEstablishmentFn } from "#/server/fns/establishments";

const BUSINESS_TYPE_VALUES = BUSINESS_TYPE_OPTIONS.map(
	(o) => o.value,
) as unknown as readonly [BusinessType, ...BusinessType[]];

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

const LANGUAGE_OPTIONS: ReadonlyArray<{
	readonly value: string;
	readonly label: string;
	readonly disabled?: boolean;
}> = [
	{ value: "fr", label: "🇫🇷  Français" },
	{ value: "en", label: "🇬🇧  Anglais" },
	{ value: "it", label: "🇮🇹  Italien (bientôt)", disabled: true },
	{ value: "es", label: "🇪🇸  Espagnol (bientôt)", disabled: true },
];

const formSchema = z.object({
	name: z.string().trim().min(1, "Nom requis").max(100),
	city: z.string().trim().min(1, "Ville requise").max(100),
	postalCode: z.string().trim().max(20, "Code postal trop long"),
	businessType: z.enum(BUSINESS_TYPE_VALUES),
	languageCode: z
		.string()
		.regex(/^[a-z]{2}$/, "Code langue sur 2 lettres (ex. fr)"),
	defaultTone: z.enum(["warm", "professional", "direct"] as const),
	brandContext: z.string().max(5000, "Trop long (5 000 caractères max)"),
});

type FormValues = z.infer<typeof formSchema>;

export const Route = createFileRoute("/_authed/establishments/new")({
	component: NewEstablishmentPage,
});

function NewEstablishmentPage() {
	const navigate = useNavigate();

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: {
			name: "",
			city: "",
			postalCode: "",
			businessType: "restaurant",
			languageCode: "fr",
			defaultTone: "warm",
			brandContext: "",
		},
	});

	const handle = async (values: FormValues) => {
		form.clearErrors("root");
		const result = await createEstablishmentFn({
			data: {
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
			await navigate({ to: "/establishments" });
			return;
		}
		form.setError("root", {
			message:
				result.kind === "unauthenticated"
					? "Ta session a expiré. Reconnecte-toi pour créer un établissement."
					: "Impossible de créer l'établissement. Réessaie dans un instant.",
		});
	};

	const rootError = form.formState.errors.root?.message;
	const isSubmitting = form.formState.isSubmitting;

	return (
		<div className="mx-auto max-w-[600px] px-10 py-8">
			<Link
				to="/establishments"
				className="mb-[22px] inline-flex items-center gap-1.5 text-[12.5px] text-ink-soft hover:text-ink"
			>
				<ArrowLeft size={14} strokeWidth={1.75} />
				Retour à la liste
			</Link>

			<div className="font-mono text-[11px] text-ink-mute uppercase tracking-[0.08em]">
				Nouvel établissement
			</div>
			<h1
				className="m-[6px_0_10px] font-serif font-normal text-ink tracking-[-0.02em]"
				style={{ fontSize: 40 }}
			>
				Une <span className="text-accent-ink italic">nouvelle adresse.</span>
			</h1>
			<p className="mb-8 text-[14px] text-ink-soft">
				Quelques informations pour qu'Avizio sache de qui parler.
			</p>

			<form onSubmit={form.handleSubmit(handle)} noValidate>
				<Card padding={28}>
					<div className="flex flex-col gap-5">
						<Field label="Nom de l'établissement">
							<Input
								{...form.register("name")}
								placeholder="La Maison Pléiade"
							/>
							{form.formState.errors.name?.message ? (
								<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
									{form.formState.errors.name.message}
								</p>
							) : null}
						</Field>

						<div
							className="grid gap-3"
							style={{ gridTemplateColumns: "2fr 1fr" }}
						>
							<Field label="Ville">
								<Input {...form.register("city")} placeholder="Lyon" />
								{form.formState.errors.city?.message ? (
									<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
										{form.formState.errors.city.message}
									</p>
								) : null}
							</Field>
							<Field label="Code postal">
								<Input {...form.register("postalCode")} placeholder="69002" />
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
									<BusinessPill
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
							<LanguageSelect
								value={form.watch("languageCode")}
								onChange={(v) =>
									form.setValue("languageCode", v, { shouldDirty: true })
								}
							/>
						</Field>

						<Field
							label="Ton par défaut"
							help="Tu pourras le changer à chaque réponse."
						>
							<div
								className="grid gap-2"
								style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
							>
								{TONE_OPTIONS.map((opt) => (
									<ChoiceCard
										key={opt.value}
										label={opt.label}
										sub={opt.subtitle}
										active={form.watch("defaultTone") === opt.value}
										onClick={() =>
											form.setValue("defaultTone", opt.value, {
												shouldDirty: true,
											})
										}
									/>
								))}
							</div>
						</Field>

						<Field
							label="Contexte de marque"
							help="Optionnel · tu pourras compléter plus tard. Noms d'équipe, spécialités, formule de signature."
						>
							<Textarea
								{...form.register("brandContext")}
								rows={5}
								placeholder={`Ex : Restaurant de cuisine contemporaine, ouvert en 2018.\nChef : Sébastien Lenoir.\nSigner « L'équipe de La Maison Pléiade ».`}
							/>
							{form.formState.errors.brandContext?.message ? (
								<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
									{form.formState.errors.brandContext.message}
								</p>
							) : null}
						</Field>
					</div>
				</Card>

				{rootError ? (
					<p className="mt-4 rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[13px] text-[oklch(0.4_0.12_25)]">
						{rootError}
					</p>
				) : null}

				<div className="mt-[22px] flex justify-end gap-2.5">
					<Link to="/establishments">
						<Button
							type="button"
							variant="ghost"
							size="md"
							disabled={isSubmitting}
						>
							Annuler
						</Button>
					</Link>
					<Button
						type="submit"
						variant="accent"
						size="md"
						iconRight={<ArrowRight size={14} strokeWidth={1.75} />}
						disabled={isSubmitting}
					>
						{isSubmitting ? "Création…" : "Créer l'établissement"}
					</Button>
				</div>

				<p className="mt-[18px] text-center text-[11.5px] text-ink-mute">
					Prochaine étape : connecter vos comptes Google Business, TripAdvisor
					et Trustpilot.
				</p>
			</form>
		</div>
	);
}

type PillProps = {
	readonly value: BusinessType;
	readonly label: string;
	readonly active: boolean;
	readonly onSelect: () => void;
};

function BusinessPill({ label, active, onSelect }: PillProps) {
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

type LanguageSelectProps = {
	readonly value: string;
	readonly onChange: (next: string) => void;
};

function LanguageSelect({ value, onChange }: LanguageSelectProps) {
	return (
		<div className="relative">
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="w-full appearance-none rounded-lg border border-line bg-paper px-3.5 py-2.5 pr-9 text-[14px] text-ink outline-none transition-colors focus:border-accent"
			>
				{LANGUAGE_OPTIONS.map((opt) => (
					<option key={opt.value} value={opt.value} disabled={opt.disabled}>
						{opt.label}
					</option>
				))}
			</select>
			<ChevronDown
				size={15}
				strokeWidth={1.75}
				className="pointer-events-none absolute top-[12px] right-3 text-ink-mute"
			/>
		</div>
	);
}
