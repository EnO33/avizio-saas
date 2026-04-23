import { useSignIn } from "@clerk/tanstack-react-start";
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
					"Authentification à deux facteurs requise — pas encore supportée côté UI. Contacte le support.",
			});
			return;
		}
		// Trust the password result: if no error, finalize. `signIn.status`
		// can be stale in this React tick, so we don't gate on it.
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
		// Hard reload so the next request carries the freshly-set Clerk
		// cookies — `/dashboard` then authenticates server-side via
		// `_authed.beforeLoad` and renders. Clerk's built-in `navigate` is a
		// no-op for custom flows, so we own the redirect here.
		window.location.href = "/dashboard";
	};

	const onGoogle = async () => {
		form.clearErrors("root");
		await signIn.sso({
			strategy: "oauth_google",
			redirectCallbackUrl: "/sso-callback",
			redirectUrl: "/sign-in",
		});
	};

	return (
		<AuthLayout
			title="Connexion"
			subtitle="Content de vous revoir."
			footer={
				<>
					Pas encore de compte ?{" "}
					<Link
						to="/sign-up"
						className="font-medium text-amber-700 hover:underline"
					>
						Créer un compte
					</Link>
				</>
			}
		>
			<div className="space-y-4">
				<GoogleButton onClick={onGoogle} disabled={isFetching} />
				<Divider />
				<form
					onSubmit={form.handleSubmit(onSubmit)}
					className="space-y-4"
					noValidate
				>
					<TextField
						label="Email"
						type="email"
						autoComplete="email"
						{...form.register("email")}
						error={form.formState.errors.email?.message}
					/>
					<div>
						<TextField
							label="Mot de passe"
							type="password"
							autoComplete="current-password"
							{...form.register("password")}
							error={form.formState.errors.password?.message}
						/>
						<div className="mt-2 text-right">
							<Link
								to="/forgot-password"
								className="text-neutral-600 text-xs hover:text-amber-700 hover:underline"
							>
								Mot de passe oublié ?
							</Link>
						</div>
					</div>
					{topLevelError ? (
						<p className="rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm">
							{topLevelError}
						</p>
					) : null}
					<button
						type="submit"
						disabled={isFetching}
						className="w-full rounded-md bg-neutral-900 py-2.5 font-medium text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isFetching ? "Connexion…" : "Se connecter"}
					</button>
				</form>
			</div>
		</AuthLayout>
	);
}
