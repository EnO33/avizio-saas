import { ClerkProvider } from "@clerk/tanstack-react-start";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import appCss from "../styles.css?url";

// Dev-only devtools. Dynamic import + `import.meta.env.DEV` gate so the
// devtools module isn't bundled in prod — it touches `window` at import
// time via `@solid-primitives/event-listener` and crashes SSR.
const DevTools = import.meta.env.DEV
	? lazy(() => import("../components/shared/devtools"))
	: null;

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Avizio — Gestion des avis clients",
			},
			{
				name: "description",
				content:
					"Avizio aide les commerces de proximité à gérer et répondre aux avis Google, TripAdvisor et Trustpilot avec l'IA.",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="fr">
			<head>
				<HeadContent />
			</head>
			<body>
				<ClerkProvider>{children}</ClerkProvider>
				{DevTools ? (
					<Suspense>
						<DevTools />
					</Suspense>
				) : null}
				<Scripts />
			</body>
		</html>
	);
}
