import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sso-callback")({
	component: SsoCallbackPage,
});

function SsoCallbackPage() {
	return null;
}
