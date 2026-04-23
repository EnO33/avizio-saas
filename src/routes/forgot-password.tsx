import { useSignIn } from "@clerk/tanstack-react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthLayout } from "#/components/auth/auth-layout";
import { clerkErrorToMessage } from "#/components/auth/clerk-error";
import { TextField } from "#/components/auth/text-field";

const emailSchema = z.object({
	email: z.email("Email invalide"),
});

const resetSchema = z
	.object({
		code: z
			.string()
			.length(6, "Le code fait 6 chiffres")
			.regex(/^\d+$/, "Chiffres uniquement"),
		password: z
			.string()
			.min(8, "Le mot de passe doit faire au moins 8 caractères"),
		passwordConfirm: z.string(),
	})
	.refine((data) => data.password === data.passwordConfirm, {
		message: "Les mots de passe ne correspondent pas",
		path: ["passwordConfirm"],
	});

type EmailInput = z.infer<typeof emailSchema>;
type ResetInput = z.infer<typeof resetSchema>;

export const Route = createFileRoute("/forgot-password")({
	component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
	const { signIn, fetchStatus } = useSignIn();
	const isFetching = fetchStatus === "fetching";
	const [step, setStep] = useState<"request" | "reset">("request");

	const emailForm = useForm<EmailInput>({
		resolver: zodResolver(emailSchema),
		defaultValues: { email: "" },
	});

	const resetForm = useForm<ResetInput>({
		resolver: zodResolver(resetSchema),
		defaultValues: { code: "", password: "", passwordConfirm: "" },
	});

	const onSubmitEmail = async ({ email }: EmailInput) => {
		emailForm.clearErrors("root");
		const createResult = await signIn.create({ identifier: email });
		if (createResult.error) {
			emailForm.setError("root", {
				message: clerkErrorToMessage(
					createResult.error,
					"Email introuvable ou demande impossible.",
				),
			});
			return;
		}
		const sendResult = await signIn.resetPasswordEmailCode.sendCode();
		if (sendResult.error) {
			emailForm.setError("root", {
				message: clerkErrorToMessage(
					sendResult.error,
					"Impossible d'envoyer le code. Réessayez.",
				),
			});
			return;
		}
		setStep("reset");
	};

	const onSubmitReset = async ({ code, password }: ResetInput) => {
		resetForm.clearErrors("root");
		const verifyResult = await signIn.resetPasswordEmailCode.verifyCode({
			code,
		});
		if (verifyResult.error) {
			resetForm.setError("root", {
				message: clerkErrorToMessage(verifyResult.error, "Code invalide."),
			});
			return;
		}
		const submitResult = await signIn.resetPasswordEmailCode.submitPassword({
			password,
		});
		if (submitResult.error) {
			resetForm.setError("root", {
				message: clerkErrorToMessage(
					submitResult.error,
					"Impossible de mettre à jour le mot de passe.",
				),
			});
			return;
		}
		// Trust the submitPassword result (no error ⇒ password reset succeeded)
		// and let Clerk's default navigate handle the redirect via
		// `signInFallbackRedirectUrl` on ClerkProvider.
		const finalizeResult = await signIn.finalize();
		if (finalizeResult.error) {
			resetForm.setError("root", {
				message: clerkErrorToMessage(
					finalizeResult.error,
					"Impossible de finaliser la réinitialisation.",
				),
			});
		}
	};

	if (step === "reset") {
		const rootError = resetForm.formState.errors.root?.message;
		return (
			<AuthLayout
				title="Nouveau mot de passe"
				subtitle="Entre le code reçu par email et ton nouveau mot de passe."
				footer={
					<>
						Tu n'as rien reçu ?{" "}
						<button
							type="button"
							onClick={() => setStep("request")}
							className="font-medium text-amber-700 hover:underline"
						>
							Renvoyer un code
						</button>
					</>
				}
			>
				<form
					onSubmit={resetForm.handleSubmit(onSubmitReset)}
					className="space-y-4"
					noValidate
				>
					<TextField
						label="Code de vérification"
						inputMode="numeric"
						autoComplete="one-time-code"
						maxLength={6}
						{...resetForm.register("code")}
						error={resetForm.formState.errors.code?.message}
					/>
					<TextField
						label="Nouveau mot de passe"
						type="password"
						autoComplete="new-password"
						{...resetForm.register("password")}
						error={resetForm.formState.errors.password?.message}
					/>
					<TextField
						label="Confirmer le mot de passe"
						type="password"
						autoComplete="new-password"
						{...resetForm.register("passwordConfirm")}
						error={resetForm.formState.errors.passwordConfirm?.message}
					/>
					{rootError ? (
						<p className="rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm">
							{rootError}
						</p>
					) : null}
					<button
						type="submit"
						disabled={isFetching}
						className="w-full rounded-md bg-neutral-900 py-2.5 font-medium text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isFetching ? "Enregistrement…" : "Réinitialiser"}
					</button>
				</form>
			</AuthLayout>
		);
	}

	const rootError = emailForm.formState.errors.root?.message;
	return (
		<AuthLayout
			title="Mot de passe oublié"
			subtitle="On t'envoie un code pour en créer un nouveau."
			footer={
				<Link
					to="/sign-in"
					className="font-medium text-amber-700 hover:underline"
				>
					Retour à la connexion
				</Link>
			}
		>
			<form
				onSubmit={emailForm.handleSubmit(onSubmitEmail)}
				className="space-y-4"
				noValidate
			>
				<TextField
					label="Email"
					type="email"
					autoComplete="email"
					{...emailForm.register("email")}
					error={emailForm.formState.errors.email?.message}
				/>
				{rootError ? (
					<p className="rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm">
						{rootError}
					</p>
				) : null}
				<button
					type="submit"
					disabled={isFetching}
					className="w-full rounded-md bg-neutral-900 py-2.5 font-medium text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isFetching ? "Envoi…" : "Envoyer le code"}
				</button>
			</form>
		</AuthLayout>
	);
}
