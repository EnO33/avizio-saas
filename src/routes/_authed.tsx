import { auth } from "@clerk/tanstack-react-start/server";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const ensureAuthenticated = createServerFn().handler(async () => {
	const session = await auth();
	if (!session.isAuthenticated) {
		throw redirect({ to: "/" });
	}
	return { userId: session.userId, orgId: session.orgId };
});

export const Route = createFileRoute("/_authed")({
	beforeLoad: async () => ensureAuthenticated(),
	component: AuthedLayout,
});

function AuthedLayout() {
	return <Outlet />;
}
