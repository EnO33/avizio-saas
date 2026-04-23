import { createFileRoute, Outlet } from "@tanstack/react-router";
import { ensureSignedIn } from "#/server/fns/auth-guards";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async () => ensureSignedIn(),
	component: AuthedLayout,
});

function AuthedLayout() {
	return <Outlet />;
}
