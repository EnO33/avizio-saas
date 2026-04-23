import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyReviewsState } from "#/components/reviews/empty-reviews-state";
import { ReviewsTable } from "#/components/reviews/reviews-table";
import { listConnections } from "#/server/fns/connections";
import { listReviews } from "#/server/fns/reviews";

export const Route = createFileRoute("/_authed/reviews")({
	loader: async () => {
		const [reviews, connections] = await Promise.all([
			listReviews(),
			listConnections(),
		]);
		return { reviews, connections };
	},
	component: ReviewsPage,
});

function ReviewsPage() {
	const { reviews, connections } = Route.useLoaderData();
	const hasConnection = connections.length > 0;

	return (
		<main className="mx-auto max-w-5xl space-y-6 p-8">
			<header className="flex items-center justify-between">
				<div>
					<Link
						to="/dashboard"
						className="text-neutral-500 text-sm hover:text-neutral-900"
					>
						← Dashboard
					</Link>
					<h1 className="mt-2 font-bold text-3xl tracking-tight">Avis</h1>
					<p className="mt-1 text-neutral-500 text-sm">
						{reviews.length === 0
							? "Aucun avis pour le moment."
							: reviews.length === 1
								? "1 avis"
								: `${reviews.length} avis`}
					</p>
				</div>
			</header>

			{reviews.length === 0 ? (
				<EmptyReviewsState hasConnection={hasConnection} />
			) : (
				<ReviewsTable reviews={reviews} />
			)}
		</main>
	);
}
