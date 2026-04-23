import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/establishments/$id")({
	component: EditEstablishmentPage,
});

function EditEstablishmentPage() {
	return (
		<main className="mx-auto max-w-2xl p-8">
			<p className="text-neutral-500">À venir dans le prochain commit…</p>
		</main>
	);
}
