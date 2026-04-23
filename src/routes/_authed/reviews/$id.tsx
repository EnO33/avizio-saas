import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authed/reviews/$id")({
	component: ReviewDetailPage,
});

function ReviewDetailPage() {
	return (
		<main className="mx-auto max-w-3xl p-8">
			<p className="text-neutral-500">À venir dans le prochain commit…</p>
		</main>
	);
}
