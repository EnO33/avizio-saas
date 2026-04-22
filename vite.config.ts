import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig(({ command }) => ({
	resolve: { tsconfigPaths: true },
	plugins: [
		// `@tanstack/devtools-vite` wraps every JSX element in `jsxDEV` calls
		// (for `data-tsd-source` attrs). In a production build React's prod
		// runtime does not export `jsxDEV`, which crashes SSR with
		// `TypeError: jsxDEV is not a function`. Keep the plugin dev-only.
		command === "serve" && devtools(),
		nitro({ rollupConfig: { external: [/^@sentry\//] } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
}));

export default config;
