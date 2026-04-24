import { useUser } from "@clerk/tanstack-react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, KeyRound } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";

const profileSchema = z.object({
	firstName: z.string().trim().max(50),
	lastName: z.string().trim().max(50),
});

type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
	.object({
		currentPassword: z.string().min(1, "Mot de passe actuel requis"),
		newPassword: z
			.string()
			.min(8, "8 caractères minimum")
			.max(200, "200 caractères maximum"),
		confirmPassword: z.string(),
	})
	.refine((v) => v.newPassword === v.confirmPassword, {
		path: ["confirmPassword"],
		message: "Les mots de passe ne correspondent pas",
	});

type PasswordValues = z.infer<typeof passwordSchema>;

/**
 * Section « Mon compte » — profil user (prénom, nom, email) + sécurité
 * (mot de passe). L'email est read-only : le changer requiert une
 * vérification OTP côté Clerk qu'on n'exposera que le jour où on a
 * un vrai besoin (changement d'adresse professionnelle). Le form
 * password est gaté par `user.passwordEnabled` — pas d'affichage pour
 * les comptes créés via SSO seul (Google), ils n'ont pas de mot de
 * passe Clerk.
 */
export function AccountSection() {
	return (
		<section id="account" data-settings-section>
			<div className="flex flex-col gap-6">
				<ProfileCard />
				<SecurityCard />
			</div>
		</section>
	);
}

function ProfileCard() {
	const { user } = useUser();
	const [savedAt, setSavedAt] = useState<Date | null>(null);

	const form = useForm<ProfileValues>({
		resolver: zodResolver(profileSchema),
		defaultValues: {
			firstName: user?.firstName ?? "",
			lastName: user?.lastName ?? "",
		},
	});

	if (!user) return null;

	const isDirty = form.formState.isDirty;
	const isSubmitting = form.formState.isSubmitting;
	const rootError = form.formState.errors.root?.message;
	const email = user.primaryEmailAddress?.emailAddress ?? "—";

	const handle = async (values: ProfileValues) => {
		form.clearErrors("root");
		try {
			await user.update({
				firstName: values.firstName.trim(),
				lastName: values.lastName.trim(),
			});
			form.reset(values);
			setSavedAt(new Date());
		} catch (err) {
			form.setError("root", {
				message:
					err instanceof Error && err.message
						? err.message
						: "Impossible d'enregistrer. Réessaie.",
			});
		}
	};

	return (
		<Card padding={24}>
			<h2 className="mb-1 font-serif font-normal text-[22px]">Profil</h2>
			<p className="mb-5 text-[13px] text-ink-mute">
				Votre identité dans l'app et dans les réponses publiées.
			</p>

			<form
				onSubmit={form.handleSubmit(handle)}
				className="flex flex-col gap-4"
				noValidate
			>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<Field label="Prénom">
						<Input {...form.register("firstName")} placeholder="Hélène" />
					</Field>
					<Field label="Nom">
						<Input {...form.register("lastName")} placeholder="Duval" />
					</Field>
				</div>

				<Field
					label="Email"
					help="Pour changer votre email, contactez-nous via hello@avizio.fr."
				>
					<Input value={email} readOnly disabled />
				</Field>

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
						onClick={() => form.reset()}
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
						{isSubmitting ? "Enregistrement…" : "Enregistrer"}
					</Button>
				</div>
			</form>
		</Card>
	);
}

function SecurityCard() {
	const { user } = useUser();
	const [editing, setEditing] = useState(false);

	if (!user) return null;

	const hasPassword = user.passwordEnabled;

	return (
		<Card padding={24}>
			<h2 className="mb-1 font-serif font-normal text-[22px]">Sécurité</h2>
			<p className="mb-5 text-[13px] text-ink-mute">
				Mot de passe de votre compte Avizio.
			</p>

			{!hasPassword ? (
				<p className="rounded-md bg-bg-deep px-4 py-3 text-[13px] text-ink-soft">
					Votre compte est connecté via Google. Le mot de passe est géré chez
					Google — aucune action requise ici.
				</p>
			) : editing ? (
				<PasswordForm
					onDone={() => setEditing(false)}
					onCancel={() => setEditing(false)}
				/>
			) : (
				<Button
					variant="outline"
					size="md"
					icon={<KeyRound size={14} strokeWidth={1.75} />}
					onClick={() => setEditing(true)}
				>
					Modifier le mot de passe
				</Button>
			)}
		</Card>
	);
}

function PasswordForm({
	onDone,
	onCancel,
}: {
	onDone: () => void;
	onCancel: () => void;
}) {
	const { user } = useUser();
	const [savedAt, setSavedAt] = useState<Date | null>(null);

	const form = useForm<PasswordValues>({
		resolver: zodResolver(passwordSchema),
		defaultValues: {
			currentPassword: "",
			newPassword: "",
			confirmPassword: "",
		},
	});

	if (!user) return null;

	const isSubmitting = form.formState.isSubmitting;
	const rootError = form.formState.errors.root?.message;

	const handle = async (values: PasswordValues) => {
		form.clearErrors("root");
		try {
			await user.updatePassword({
				currentPassword: values.currentPassword,
				newPassword: values.newPassword,
				// `signOutOfOtherSessions: true` éjecte les autres navigateurs
				// après changement — précaution si le compte est compromis. Le
				// user reste connecté ici.
				signOutOfOtherSessions: true,
			});
			setSavedAt(new Date());
			form.reset({
				currentPassword: "",
				newPassword: "",
				confirmPassword: "",
			});
			// Petite latence pour que « Enregistré ✓ » soit visible avant fermeture.
			setTimeout(onDone, 1200);
		} catch (err) {
			form.setError("root", {
				message:
					err instanceof Error && err.message
						? err.message
						: "Impossible de changer le mot de passe. Vérifie le mot de passe actuel.",
			});
		}
	};

	return (
		<form
			onSubmit={form.handleSubmit(handle)}
			className="flex flex-col gap-4"
			noValidate
		>
			<Field label="Mot de passe actuel">
				<Input
					type="password"
					autoComplete="current-password"
					{...form.register("currentPassword")}
				/>
				{form.formState.errors.currentPassword?.message ? (
					<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
						{form.formState.errors.currentPassword.message}
					</p>
				) : null}
			</Field>
			<Field label="Nouveau mot de passe" help="8 caractères minimum.">
				<Input
					type="password"
					autoComplete="new-password"
					{...form.register("newPassword")}
				/>
				{form.formState.errors.newPassword?.message ? (
					<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
						{form.formState.errors.newPassword.message}
					</p>
				) : null}
			</Field>
			<Field label="Confirmer le nouveau mot de passe">
				<Input
					type="password"
					autoComplete="new-password"
					{...form.register("confirmPassword")}
				/>
				{form.formState.errors.confirmPassword?.message ? (
					<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
						{form.formState.errors.confirmPassword.message}
					</p>
				) : null}
			</Field>

			{rootError ? (
				<p className="rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[13px] text-[oklch(0.4_0.12_25)]">
					{rootError}
				</p>
			) : null}

			<div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center sm:justify-end">
				{savedAt ? (
					<span className="text-[12px] text-green sm:self-center">
						Mot de passe mis à jour ✓
					</span>
				) : null}
				<Button
					variant="ghost"
					size="md"
					onClick={onCancel}
					disabled={isSubmitting}
					type="button"
				>
					Annuler
				</Button>
				<Button
					variant="accent"
					size="md"
					icon={<Check size={14} strokeWidth={1.75} />}
					disabled={isSubmitting}
					type="submit"
				>
					{isSubmitting ? "Enregistrement…" : "Changer"}
				</Button>
			</div>
		</form>
	);
}
