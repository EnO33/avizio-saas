import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { TextField } from "#/components/auth/text-field";
import type { BusinessType } from "#/server/db/queries/establishments";
import { BUSINESS_TYPE_OPTIONS } from "./business-types";

const BUSINESS_TYPE_VALUES = BUSINESS_TYPE_OPTIONS.map(
	(o) => o.value,
) as unknown as readonly [BusinessType, ...BusinessType[]];

export const establishmentFormSchema = z.object({
	name: z.string().trim().min(1, "Nom requis").max(100),
	city: z.string().trim().min(1, "Ville requise").max(100),
	// Empty string is allowed and means "no postal code". The caller
	// translates it to `null` at the DB boundary.
	postalCode: z.string().trim().max(20, "Code postal trop long"),
	businessType: z.enum(BUSINESS_TYPE_VALUES),
	languageCode: z
		.string()
		.regex(/^[a-z]{2}$/, "Code langue sur 2 lettres (ex. fr)"),
});

export type EstablishmentFormValues = z.infer<typeof establishmentFormSchema>;

/**
 * Reusable create/edit form. The owner decides what to do with the
 * validated values — create a new row, update an existing one — and
 * returns a French error message when the submit fails so the form can
 * render it inline. `undefined` means success; the parent navigates away.
 */
type Props = {
	readonly initialValues?: Partial<EstablishmentFormValues>;
	readonly submitLabel: string;
	readonly onSubmit: (
		values: EstablishmentFormValues,
	) => Promise<string | undefined>;
};

export function EstablishmentForm({
	initialValues,
	submitLabel,
	onSubmit,
}: Props) {
	const form = useForm<EstablishmentFormValues>({
		resolver: zodResolver(establishmentFormSchema),
		defaultValues: {
			name: initialValues?.name ?? "",
			city: initialValues?.city ?? "",
			postalCode: initialValues?.postalCode ?? "",
			businessType: initialValues?.businessType ?? "restaurant",
			languageCode: initialValues?.languageCode ?? "fr",
		},
	});

	const handle = async (values: EstablishmentFormValues) => {
		form.clearErrors("root");
		const error = await onSubmit(values);
		if (error) form.setError("root", { message: error });
	};

	const rootError = form.formState.errors.root?.message;
	const isSubmitting = form.formState.isSubmitting;

	return (
		<form onSubmit={form.handleSubmit(handle)} className="space-y-4" noValidate>
			<TextField
				label="Nom"
				autoComplete="organization"
				{...form.register("name")}
				error={form.formState.errors.name?.message}
			/>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_10rem]">
				<TextField
					label="Ville"
					autoComplete="address-level2"
					{...form.register("city")}
					error={form.formState.errors.city?.message}
				/>
				<TextField
					label="Code postal"
					autoComplete="postal-code"
					{...form.register("postalCode")}
					error={form.formState.errors.postalCode?.message}
				/>
			</div>
			<SelectField
				label="Type d'activité"
				options={BUSINESS_TYPE_OPTIONS}
				{...form.register("businessType")}
				error={form.formState.errors.businessType?.message}
			/>
			{rootError ? (
				<p className="rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm">
					{rootError}
				</p>
			) : null}
			<button
				type="submit"
				disabled={isSubmitting}
				className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isSubmitting ? "Enregistrement…" : submitLabel}
			</button>
		</form>
	);
}

type SelectFieldProps = Omit<
	React.SelectHTMLAttributes<HTMLSelectElement>,
	"children"
> & {
	readonly ref?: React.Ref<HTMLSelectElement>;
	readonly label: string;
	readonly options: ReadonlyArray<{
		readonly value: string;
		readonly label: string;
	}>;
	readonly error?: string | undefined;
};

function SelectField({
	ref,
	label,
	options,
	error,
	id,
	name,
	...rest
}: SelectFieldProps) {
	const fieldId = id ?? name;
	return (
		<div>
			<label
				htmlFor={fieldId}
				className="block font-medium text-neutral-900 text-sm"
			>
				{label}
			</label>
			<select
				ref={ref}
				id={fieldId}
				name={name}
				aria-invalid={error ? "true" : undefined}
				className="mt-1 block w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-900 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 aria-invalid:border-red-500"
				{...rest}
			>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
			{error ? (
				<p className="mt-1 text-red-600 text-sm" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
