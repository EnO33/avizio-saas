import { AuthenticateWithRedirectCallback } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sso-callback")({
	component: SsoCallbackPage,
});

function SsoCallbackPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50/60 to-white px-6">
			<div className="text-center">
				<div className="mx-auto size-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
				<p className="mt-4 text-neutral-600 text-sm">Connexion en cours…</p>
			</div>
			{/*
			 * Clerk's helper consumes the `?__clerk_*` query params set by the
			 * OAuth provider, completes or transfers the session, then navigates
			 * to the configured destination. It also renders a `<div id="clerk-captcha" />`
			 * internally when transferring to sign-up.
			 */}
			<AuthenticateWithRedirectCallback
				signInForceRedirectUrl="/dashboard"
				signUpForceRedirectUrl="/dashboard"
			/>
		</main>
	);
}
