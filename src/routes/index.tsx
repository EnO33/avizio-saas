import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="mx-auto max-w-2xl p-8">
			<h1 className="text-4xl font-bold tracking-tight">Avizio</h1>
			<p className="mt-4 text-lg text-neutral-600">
				Gérez et répondez aux avis clients de votre commerce avec l'IA.
			</p>
		</main>
	);
}
