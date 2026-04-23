import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sign-up")({
	component: SignUpPage,
});

function SignUpPage() {
	return null;
}
