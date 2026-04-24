import { useSignIn } from "@clerk/tanstack-react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bell } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthLayout } from "#/components/auth/auth-layout";
import { clerkErrorToMessage } from "#/components/auth/clerk-error";
import { Button } from "#/components/ui/button";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { OtpInput } from "#/components/ui/otp-input";
import { redirectIfSignedIn } from "#/server/fns/auth-guards";

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
	})
	.strict();

type EmailInput = z.infer<typeof emailSchema>;
type ResetInput = z.infer<typeof resetSchema>;

export const Route = createFileRoute("/forgot-password")({
	beforeLoad: async () => redirectIfSignedIn(),
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
		defaultValues: { code: "", password: "" },
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
		const finalizeResult = await signIn.finalize();
		if (finalizeResult.error) {
			resetForm.setError("root", {
				message: clerkErrorToMessage(
					finalizeResult.error,
					"Impossible de finaliser la réinitialisation.",
				),
			});
			return;
		}
		// Hard reload pour que `/dashboard` authentifie via les cookies
		// Clerk fraîchement set. Les custom flows n'ont pas d'auto-nav.
		window.location.href = "/dashboard";
	};

	if (step === "reset") {
		return (
			<ResetStep
				form={resetForm}
				isFetching={isFetching}
				onSubmit={onSubmitReset}
				onResend={() => void signIn.resetPasswordEmailCode.sendCode()}
			/>
		);
	}

	const rootError = emailForm.formState.errors.root?.message;
	return (
		<AuthLayout
			mode="forgot-password"
			kicker="Mot de passe oublié"
			heading="On vous remet sur pied."
			subtitle="Entrez votre email — on vous envoie un code à 6 chiffres."
			footer={
				<>
					Vous vous souvenez ?
					<Link
						to="/sign-in"
						className="font-medium text-accent-ink hover:underline"
					>
						Se connecter
					</Link>
				</>
			}
		>
			<form
				onSubmit={emailForm.handleSubmit(onSubmitEmail)}
				className="flex flex-col gap-3.5"
				noValidate
			>
				<Field label="Email">
					<Input
						type="email"
						autoComplete="email"
						placeholder="helene@pleiade.fr"
						{...emailForm.register("email")}
					/>
					{emailForm.formState.errors.email?.message ? (
						<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
							{emailForm.formState.errors.email.message}
						</p>
					) : null}
				</Field>
				{rootError ? (
					<p className="rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[12.5px] text-[oklch(0.4_0.12_25)]">
						{rootError}
					</p>
				) : null}
				<Button
					variant="accent"
					size="lg"
					type="submit"
					className="mt-2 w-full"
					iconRight={<ArrowRight size={14} strokeWidth={1.75} />}
					disabled={isFetching}
				>
					{isFetching ? "Envoi…" : "Envoyer le code"}
				</Button>
			</form>
		</AuthLayout>
	);
}

type ResetStepProps = {
	readonly form: ReturnType<typeof useForm<ResetInput>>;
	readonly isFetching: boolean;
	readonly onSubmit: (values: ResetInput) => Promise<void>;
	readonly onResend: () => void;
};

function ResetStep({ form, isFetching, onSubmit, onResend }: ResetStepProps) {
	const rootError = form.formState.errors.root?.message;
	return (
		<AuthLayout
			mode="forgot-password"
			kicker="Nouveau mot de passe"
			heading={
				<>
					Code <span className="text-accent-ink italic">envoyé.</span>
				</>
			}
			subtitle="Saisissez le code reçu par email, puis choisissez un nouveau mot de passe."
			footer={
				<>
					Pas reçu ?
					<button
						type="button"
						onClick={onResend}
						className="cursor-pointer border-none bg-transparent p-0 font-medium text-accent-ink hover:underline"
					>
						Renvoyer un code
					</button>
				</>
			}
		>
			<form
				onSubmit={form.handleSubmit(onSubmit)}
				className="flex flex-col gap-[18px]"
				noValidate
			>
				<Field label="Code à 6 chiffres">
					<OtpInput
						value={form.watch("code")}
						onChange={(v) => form.setValue("code", v)}
						autoFocus
					/>
					{form.formState.errors.code?.message ? (
						<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
							{form.formState.errors.code.message}
						</p>
					) : null}
				</Field>
				<Field label="Nouveau mot de passe">
					<Input
						type="password"
						autoComplete="new-password"
						placeholder="••••••••"
						{...form.register("password")}
					/>
					{form.formState.errors.password?.message ? (
						<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
							{form.formState.errors.password.message}
						</p>
					) : null}
				</Field>
				<div className="flex items-center gap-2 rounded-md bg-bg-deep px-3 py-2.5 text-[12px] text-ink-soft">
					<Bell size={13} strokeWidth={1.75} />
					Le code expire dans 15 minutes.
				</div>
				{rootError ? (
					<p className="rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[12.5px] text-[oklch(0.4_0.12_25)]">
						{rootError}
					</p>
				) : null}
				<Button
					variant="accent"
					size="lg"
					type="submit"
					className="mt-1 w-full"
					iconRight={<ArrowRight size={14} strokeWidth={1.75} />}
					disabled={isFetching}
				>
					{isFetching ? "Enregistrement…" : "Réinitialiser le mot de passe"}
				</Button>
			</form>
		</AuthLayout>
	);
}
