import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Tone } from "#/server/db/queries/establishments";

const TONE_OPTIONS: ReadonlyArray<{
	readonly value: Tone;
	readonly label: string;
	readonly description: string;
}> = [
	{
		value: "warm",
		label: "Chaleureux",
		description:
			"Accueillant, amical, proche du client. Convient aux restos et cafés.",
	},
	{
		value: "professional",
		label: "Professionnel",
		description: "Courtois, formel, posé. Convient aux hôtels et artisans.",
	},
	{
		value: "direct",
		label: "Direct",
		description:
			"Concis, factuel, sans fioritures. Convient quand tu as peu de temps.",
	},
];

const BRAND_CONTEXT_MAX = 5000;

export const establishmentSettingsFormSchema = z.object({
	defaultTone: z.enum(["warm", "professional", "direct"] as const),
	brandContext: z
		.string()
		.max(
			BRAND_CONTEXT_MAX,
			`Contexte trop long (${BRAND_CONTEXT_MAX} caractères max)`,
		),
});

export type EstablishmentSettingsFormValues = z.infer<
	typeof establishmentSettingsFormSchema
>;

type Props = {
	readonly initialValues: {
		readonly defaultTone: Tone;
		readonly brandContext: string;
	};
	readonly onSubmit: (
		values: EstablishmentSettingsFormValues,
	) => Promise<string | undefined>;
};

/**
 * Form for the AI-facing per-establishment settings — tone of voice + brand
 * context that the prompt template injects when generating review replies.
 * Kept separate from the main EstablishmentForm so the create flow stays
 * focused on identity fields, and so the user edits each concern in its
 * own surface with its own submit feedback.
 */
export function EstablishmentSettingsForm({ initialValues, onSubmit }: Props) {
	const form = useForm<EstablishmentSettingsFormValues>({
		resolver: zodResolver(establishmentSettingsFormSchema),
		defaultValues: {
			defaultTone: initialValues.defaultTone,
			brandContext: initialValues.brandContext,
		},
	});

	const handle = async (values: EstablishmentSettingsFormValues) => {
		form.clearErrors("root");
		const error = await onSubmit(values);
		if (error) {
			form.setError("root", { message: error });
		} else {
			// Reset dirty state so the "saved" feedback can show cleanly on the
			// next submit attempt.
			form.reset(values);
		}
	};

	const rootError = form.formState.errors.root?.message;
	const isSubmitting = form.formState.isSubmitting;
	const isSubmitSuccessful =
		form.formState.isSubmitSuccessful && !form.formState.isDirty;
	const brandContextValue = form.watch("brandContext") ?? "";

	return (
		<form onSubmit={form.handleSubmit(handle)} className="space-y-5" noValidate>
			<fieldset className="space-y-2">
				<legend className="font-medium text-neutral-900 text-sm">
					Ton par défaut
				</legend>
				<p className="text-neutral-500 text-xs">
					Utilisé pour générer les réponses. Tu pourras toujours changer le ton
					sur chaque avis au moment de répondre.
				</p>
				<div className="space-y-2">
					{TONE_OPTIONS.map((option) => (
						<label
							key={option.value}
							className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 transition hover:border-neutral-300 has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-50"
						>
							<input
								type="radio"
								value={option.value}
								{...form.register("defaultTone")}
								className="mt-0.5"
							/>
							<div>
								<div className="font-medium text-neutral-900 text-sm">
									{option.label}
								</div>
								<div className="mt-0.5 text-neutral-500 text-xs">
									{option.description}
								</div>
							</div>
						</label>
					))}
				</div>
				{form.formState.errors.defaultTone?.message ? (
					<p className="text-red-600 text-sm" role="alert">
						{form.formState.errors.defaultTone.message}
					</p>
				) : null}
			</fieldset>

			<div>
				<label
					htmlFor="brandContext"
					className="block font-medium text-neutral-900 text-sm"
				>
					Contexte de marque
				</label>
				<p className="mt-1 text-neutral-500 text-xs">
					Ce que l'IA doit savoir pour bien répondre : positionnement, valeurs,
					points forts, sujets sensibles à ne pas mentionner. Injecté dans le
					prompt à chaque génération.
				</p>
				<textarea
					id="brandContext"
					{...form.register("brandContext")}
					rows={6}
					maxLength={BRAND_CONTEXT_MAX}
					placeholder="Ex : Notre restaurant met l'accent sur les produits locaux et de saison. Nous privilégions une approche chaleureuse et personnelle. Ne pas mentionner : les promotions ponctuelles, les rumeurs de changement de chef."
					aria-invalid={form.formState.errors.brandContext ? "true" : undefined}
					className="mt-2 block w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-900 text-sm placeholder:text-neutral-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 aria-invalid:border-red-500"
				/>
				<div className="mt-1 flex items-center justify-between text-xs">
					<span className="text-red-600" role="alert">
						{form.formState.errors.brandContext?.message ?? ""}
					</span>
					<span className="text-neutral-400">
						{brandContextValue.length} / {BRAND_CONTEXT_MAX}
					</span>
				</div>
			</div>

			{rootError ? (
				<p className="rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm">
					{rootError}
				</p>
			) : null}

			<div className="flex items-center gap-3">
				<button
					type="submit"
					disabled={isSubmitting || !form.formState.isDirty}
					className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isSubmitting ? "Enregistrement…" : "Enregistrer les paramètres"}
				</button>
				{isSubmitSuccessful ? (
					<span className="text-emerald-700 text-sm">Enregistré ✓</span>
				) : null}
			</div>
		</form>
	);
}
