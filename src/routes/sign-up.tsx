import { useSignUp } from "@clerk/tanstack-react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bell } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthLayout } from "#/components/auth/auth-layout";
import { clerkErrorToMessage } from "#/components/auth/clerk-error";
import { SsoRow } from "#/components/auth/sso-row";
import { Button } from "#/components/ui/button";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { OtpInput } from "#/components/ui/otp-input";
import { redirectIfSignedIn } from "#/server/fns/auth-guards";

const signUpSchema = z
	.object({
		email: z.email("Email invalide"),
		password: z
			.string()
			.min(8, "Le mot de passe doit faire au moins 8 caractères"),
		passwordConfirm: z.string(),
	})
	.refine((data) => data.password === data.passwordConfirm, {
		message: "Les mots de passe ne correspondent pas",
		path: ["passwordConfirm"],
	});

type SignUpInput = z.infer<typeof signUpSchema>;

export const Route = createFileRoute("/sign-up")({
	beforeLoad: async () => redirectIfSignedIn(),
	component: SignUpPage,
});

function SignUpPage() {
	const { signUp, fetchStatus } = useSignUp();
	const isFetching = fetchStatus === "fetching";

	const signUpForm = useForm<SignUpInput>({
		resolver: zodResolver(signUpSchema),
		defaultValues: { email: "", password: "", passwordConfirm: "" },
	});

	const needsVerification =
		signUp.status === "missing_requirements" &&
		signUp.unverifiedFields?.includes("email_address") === true &&
		(signUp.missingFields?.length ?? 0) === 0;

	const onSubmitSignUp = async ({ email, password }: SignUpInput) => {
		signUpForm.clearErrors("root");
		const { error } = await signUp.password({
			emailAddress: email,
			password,
		});
		if (error) {
			signUpForm.setError("root", {
				message: clerkErrorToMessage(error, "Inscription impossible."),
			});
			return;
		}
		await signUp.verifications.sendEmailCode();
	};

	const onGoogle = async () => {
		signUpForm.clearErrors("root");
		try {
			await signUp.sso({
				strategy: "oauth_google",
				redirectCallbackUrl: "/sso-callback",
				redirectUrl: "/sign-up",
			});
		} catch (e) {
			signUpForm.setError("root", {
				message: clerkErrorToMessage(
					e,
					"Inscription Google indisponible. Réessaie dans un instant ou utilise l'email.",
				),
			});
		}
	};

	if (needsVerification) {
		return (
			<VerificationStep
				signUp={signUp}
				isFetching={isFetching}
				onResend={() => signUp.verifications.sendEmailCode()}
			/>
		);
	}

	const rootError = signUpForm.formState.errors.root?.message;

	return (
		<AuthLayout
			mode="sign-up"
			kicker="S'inscrire · essai 14 jours"
			heading="Crée ton espace."
			subtitle="Sans carte bancaire. Résiliation en un clic."
			footer={
				<>
					Déjà un compte ?
					<Link
						to="/sign-in"
						className="font-medium text-accent-ink hover:underline"
					>
						Se connecter
					</Link>
				</>
			}
		>
			<SsoRow
				label="Continuer avec Google"
				onClick={onGoogle}
				disabled={isFetching}
			/>
			<form
				onSubmit={signUpForm.handleSubmit(onSubmitSignUp)}
				className="flex flex-col gap-3.5"
				noValidate
			>
				<Field label="Email">
					<Input
						type="email"
						autoComplete="email"
						placeholder="helene@pleiade.fr"
						{...signUpForm.register("email")}
					/>
					{signUpForm.formState.errors.email?.message ? (
						<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
							{signUpForm.formState.errors.email.message}
						</p>
					) : null}
				</Field>
				<Field label="Mot de passe" help="Au moins 8 caractères.">
					<Input
						type="password"
						autoComplete="new-password"
						placeholder="••••••••"
						{...signUpForm.register("password")}
					/>
					{signUpForm.formState.errors.password?.message ? (
						<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
							{signUpForm.formState.errors.password.message}
						</p>
					) : null}
				</Field>
				<Field label="Confirmer le mot de passe">
					<Input
						type="password"
						autoComplete="new-password"
						placeholder="••••••••"
						{...signUpForm.register("passwordConfirm")}
					/>
					{signUpForm.formState.errors.passwordConfirm?.message ? (
						<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
							{signUpForm.formState.errors.passwordConfirm.message}
						</p>
					) : null}
				</Field>
				{rootError ? (
					<p className="rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[12.5px] text-[oklch(0.4_0.12_25)]">
						{rootError}
					</p>
				) : null}
				{/* Clerk Turnstile captcha mounts ici — requis avant
				    `signUp.password()`. Bot protection configurée côté dashboard. */}
				<div id="clerk-captcha" />
				<Button
					variant="accent"
					size="lg"
					type="submit"
					className="mt-2 w-full"
					iconRight={<ArrowRight size={14} strokeWidth={1.75} />}
					disabled={isFetching}
				>
					{isFetching ? "Inscription…" : "Créer mon compte"}
				</Button>
				<p className="mt-2 text-center text-[11.5px] text-ink-mute leading-[1.5]">
					En créant un compte, tu acceptes nos{" "}
					<a href="/legal/terms" className="text-ink-soft hover:underline">
						CGU
					</a>{" "}
					et notre{" "}
					<a href="/legal/privacy" className="text-ink-soft hover:underline">
						politique de confidentialité
					</a>
					.
				</p>
			</form>
		</AuthLayout>
	);
}

type VerificationStepProps = {
	readonly signUp: ReturnType<typeof useSignUp>["signUp"];
	readonly isFetching: boolean;
	readonly onResend: () => void;
};

function VerificationStep({
	signUp,
	isFetching,
	onResend,
}: VerificationStepProps) {
	const form = useForm<{ code: string }>({
		defaultValues: { code: "" },
	});

	const rootError = form.formState.errors.root?.message;

	const onComplete = async (code: string) => {
		form.clearErrors("root");
		const verifyResult = await signUp.verifications.verifyEmailCode({ code });
		if (verifyResult.error) {
			form.setError("root", {
				message: clerkErrorToMessage(
					verifyResult.error,
					"Code invalide. Réessayez.",
				),
			});
			return;
		}
		const finalizeResult = await signUp.finalize();
		if (finalizeResult.error) {
			form.setError("root", {
				message: clerkErrorToMessage(
					finalizeResult.error,
					"Impossible de finaliser l'inscription.",
				),
			});
			return;
		}
		// Nouveaux inscrits → `/onboarding` pour le flow guidé.
		window.location.href = "/onboarding";
	};

	return (
		<AuthLayout
			mode="sign-up"
			kicker="Vérification email"
			heading={
				<>
					Vérifie ton <span className="text-accent-ink italic">email.</span>
				</>
			}
			subtitle="Un code à 6 chiffres vient d'être envoyé à ton adresse. Copie-le ci-dessous."
			footer={
				<>
					Pas reçu ?
					<button
						type="button"
						onClick={onResend}
						className="cursor-pointer border-none bg-transparent p-0 font-medium text-accent-ink hover:underline"
					>
						Renvoyer le code
					</button>
				</>
			}
		>
			<div className="flex flex-col gap-[18px]">
				<Field label="Code à 6 chiffres">
					<OtpInput onComplete={(v) => void onComplete(v)} autoFocus />
				</Field>
				<div className="flex items-center gap-2 rounded-md bg-bg-deep px-3 py-2.5 text-[12px] text-ink-soft">
					<Bell size={13} strokeWidth={1.75} />
					Vérifiez vos spams si le code tarde à arriver.
				</div>
				{rootError ? (
					<p className="rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[12.5px] text-[oklch(0.4_0.12_25)]">
						{rootError}
					</p>
				) : null}
				{isFetching ? (
					<p className="text-center text-[12.5px] text-ink-mute italic">
						Vérification en cours…
					</p>
				) : null}
			</div>
		</AuthLayout>
	);
}
