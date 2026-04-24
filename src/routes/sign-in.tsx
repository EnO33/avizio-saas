import { useSignIn } from "@clerk/tanstack-react-start";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AuthLayout } from "#/components/auth/auth-layout";
import { clerkErrorToMessage } from "#/components/auth/clerk-error";
import { SsoRow } from "#/components/auth/sso-row";
import { Button } from "#/components/ui/button";
import { Field } from "#/components/ui/field";
import { Input } from "#/components/ui/input";
import { redirectIfSignedIn } from "#/server/fns/auth-guards";

const signInSchema = z.object({
	email: z.email("Email invalide"),
	password: z.string().min(1, "Mot de passe requis"),
});

type SignInInput = z.infer<typeof signInSchema>;

export const Route = createFileRoute("/sign-in")({
	beforeLoad: async () => redirectIfSignedIn(),
	component: SignInPage,
});

function SignInPage() {
	const { signIn, fetchStatus } = useSignIn();
	const isFetching = fetchStatus === "fetching";

	const form = useForm<SignInInput>({
		resolver: zodResolver(signInSchema),
		defaultValues: { email: "", password: "" },
	});
	const topLevelError = form.formState.errors.root?.message;

	const onSubmit = async ({ email, password }: SignInInput) => {
		form.clearErrors("root");
		const { error } = await signIn.password({
			emailAddress: email,
			password,
		});
		if (error) {
			form.setError("root", {
				message: clerkErrorToMessage(
					error,
					"Impossible de se connecter. Réessayez.",
				),
			});
			return;
		}
		if (signIn.status === "needs_second_factor") {
			form.setError("root", {
				message:
					"Authentification à deux facteurs requise — pas encore supportée côté UI. Contactez le support.",
			});
			return;
		}
		const finalizeResult = await signIn.finalize();
		if (finalizeResult.error) {
			form.setError("root", {
				message: clerkErrorToMessage(
					finalizeResult.error,
					"Impossible de finaliser la connexion.",
				),
			});
			return;
		}
		// Hard reload pour que `/dashboard` authentifie via les cookies
		// Clerk fraîchement set. Les custom flows ne reçoivent pas la
		// navigation Clerk built-in.
		window.location.href = "/dashboard";
	};

	const onGoogle = async () => {
		form.clearErrors("root");
		try {
			await signIn.sso({
				strategy: "oauth_google",
				redirectCallbackUrl: "/sso-callback",
				redirectUrl: "/sign-in",
			});
		} catch (e) {
			form.setError("root", {
				message: clerkErrorToMessage(
					e,
					"Connexion Google indisponible. Réessayez dans un instant ou utilisez l'email.",
				),
			});
		}
	};

	return (
		<AuthLayout
			mode="sign-in"
			kicker="Se connecter"
			heading="Content de vous revoir."
			subtitle="Vos avis vous attendent."
			footer={
				<>
					Pas encore de compte ?
					<Link
						to="/sign-up"
						className="font-medium text-accent-ink hover:underline"
					>
						Créer un espace
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
				onSubmit={form.handleSubmit(onSubmit)}
				className="flex flex-col gap-3.5"
				noValidate
			>
				<Field label="Email">
					<Input
						type="email"
						autoComplete="email"
						placeholder="helene@pleiade.fr"
						{...form.register("email")}
					/>
					{form.formState.errors.email?.message ? (
						<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
							{form.formState.errors.email.message}
						</p>
					) : null}
				</Field>
				<Field label="Mot de passe">
					<Input
						type="password"
						autoComplete="current-password"
						placeholder="••••••••"
						{...form.register("password")}
					/>
					{form.formState.errors.password?.message ? (
						<p className="mt-1 text-[12px] text-[oklch(0.5_0.12_25)]">
							{form.formState.errors.password.message}
						</p>
					) : null}
				</Field>
				<Link
					to="/forgot-password"
					className="-mt-1 self-start text-[12.5px] text-accent-ink hover:underline"
				>
					Mot de passe oublié ?
				</Link>
				{topLevelError ? (
					<p className="rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[12.5px] text-[oklch(0.4_0.12_25)]">
						{topLevelError}
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
					{isFetching ? "Connexion…" : "Se connecter"}
				</Button>
			</form>
		</AuthLayout>
	);
}
