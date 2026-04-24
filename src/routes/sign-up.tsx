import { useSignUp } from "@clerk/tanstack-react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthLayout } from "#/components/auth/auth-layout";
import { clerkErrorToMessage } from "#/components/auth/clerk-error";
import { Divider } from "#/components/auth/divider";
import { GoogleButton } from "#/components/auth/google-button";
import { TextField } from "#/components/auth/text-field";
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

const verificationSchema = z.object({
	code: z
		.string()
		.length(6, "Le code fait 6 chiffres")
		.regex(/^\d+$/, "Chiffres uniquement"),
});

type SignUpInput = z.infer<typeof signUpSchema>;
type VerificationInput = z.infer<typeof verificationSchema>;

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

	const verificationForm = useForm<VerificationInput>({
		resolver: zodResolver(verificationSchema),
		defaultValues: { code: "" },
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

	const onSubmitVerification = async ({ code }: VerificationInput) => {
		verificationForm.clearErrors("root");
		const verifyResult = await signUp.verifications.verifyEmailCode({ code });
		if (verifyResult.error) {
			verificationForm.setError("root", {
				message: clerkErrorToMessage(
					verifyResult.error,
					"Code invalide. Réessayez.",
				),
			});
			return;
		}
		// Trust the verify result — `signUp.status` can be stale in this tick.
		const finalizeResult = await signUp.finalize();
		if (finalizeResult.error) {
			verificationForm.setError("root", {
				message: clerkErrorToMessage(
					finalizeResult.error,
					"Impossible de finaliser l'inscription.",
				),
			});
			return;
		}
		// Hard reload so the next request carries the freshly-set Clerk
		// cookies. Nouveaux inscrits → `/onboarding` pour le flow guidé
		// (org + établissement + Google). Clerk's built-in `navigate` est
		// no-op en custom flow donc on route ici.
		window.location.href = "/onboarding";
	};

	const onGoogle = async () => {
		signUpForm.clearErrors("root");
		// `signUp.sso()` redirects on success; a rejected promise means the
		// SDK couldn't start the flow (stale session, network, etc.). Without
		// this catch the failure vanishes into an unhandled rejection — biome
		// allows try/catch at this external-lib boundary.
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
		const codeError = verificationForm.formState.errors.code?.message;
		const rootError = verificationForm.formState.errors.root?.message;
		return (
			<AuthLayout
				title="Vérifie ton email"
				subtitle="Un code à 6 chiffres t'a été envoyé. Rentre-le pour finaliser ton compte."
			>
				<form
					onSubmit={verificationForm.handleSubmit(onSubmitVerification)}
					className="space-y-4"
					noValidate
				>
					<TextField
						label="Code de vérification"
						inputMode="numeric"
						autoComplete="one-time-code"
						maxLength={6}
						{...verificationForm.register("code")}
						error={codeError}
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
						{isFetching ? "Vérification…" : "Vérifier"}
					</button>
					<button
						type="button"
						onClick={() => signUp.verifications.sendEmailCode()}
						className="w-full text-center text-neutral-600 text-sm hover:text-amber-700 hover:underline"
					>
						Renvoyer le code
					</button>
				</form>
			</AuthLayout>
		);
	}

	const rootError = signUpForm.formState.errors.root?.message;

	return (
		<AuthLayout
			title="Créer un compte"
			subtitle="14 jours d'essai gratuit — sans carte bancaire."
			footer={
				<>
					Déjà inscrit ?{" "}
					<Link
						to="/sign-in"
						className="font-medium text-amber-700 hover:underline"
					>
						Se connecter
					</Link>
				</>
			}
		>
			<div className="space-y-4">
				<GoogleButton
					onClick={onGoogle}
					disabled={isFetching}
					label="S'inscrire avec Google"
				/>
				<Divider />
				<form
					onSubmit={signUpForm.handleSubmit(onSubmitSignUp)}
					className="space-y-4"
					noValidate
				>
					<TextField
						label="Email"
						type="email"
						autoComplete="email"
						{...signUpForm.register("email")}
						error={signUpForm.formState.errors.email?.message}
					/>
					<TextField
						label="Mot de passe"
						type="password"
						autoComplete="new-password"
						{...signUpForm.register("password")}
						error={signUpForm.formState.errors.password?.message}
					/>
					<TextField
						label="Confirmer le mot de passe"
						type="password"
						autoComplete="new-password"
						{...signUpForm.register("passwordConfirm")}
						error={signUpForm.formState.errors.passwordConfirm?.message}
					/>
					{rootError ? (
						<p className="rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm">
							{rootError}
						</p>
					) : null}
					{/* Clerk Turnstile captcha mounts here — required before
					    `signUp.password()` is called. Bot protection settings
					    configured in the Clerk Dashboard. */}
					<div id="clerk-captcha" />
					<button
						type="submit"
						disabled={isFetching}
						className="w-full rounded-md bg-neutral-900 py-2.5 font-medium text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isFetching ? "Inscription…" : "S'inscrire"}
					</button>
				</form>
			</div>
		</AuthLayout>
	);
}
