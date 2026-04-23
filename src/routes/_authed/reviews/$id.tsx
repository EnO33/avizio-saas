import { createFileRoute, Link } from "@tanstack/react-router";
import { DraftCard } from "#/components/reviews/draft-card";
import { GenerateDraftButton } from "#/components/reviews/generate-draft-button";
import { ReviewDetailCard } from "#/components/reviews/review-detail-card";
import { getReviewDetail } from "#/server/fns/responses";

export const Route = createFileRoute("/_authed/reviews/$id")({
	loader: async ({ params }) => ({
		detail: await getReviewDetail({ data: { id: params.id } }),
	}),
	component: ReviewDetailPage,
});

function ReviewDetailPage() {
	const { detail } = Route.useLoaderData();

	if (!detail) {
		return (
			<main className="mx-auto max-w-3xl space-y-4 p-8">
				<Link
					to="/reviews"
					className="text-neutral-500 text-sm hover:text-neutral-900"
				>
					← Avis
				</Link>
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
					<h1 className="font-semibold text-amber-900 text-lg">
						Avis introuvable
					</h1>
					<p className="mt-1 text-amber-800 text-sm">
						Il a peut-être été supprimé, ou ne fait pas partie de ton
						organisation active.
					</p>
				</div>
			</main>
		);
	}

	const { review, establishment, responses } = detail;

	return (
		<main className="mx-auto max-w-3xl space-y-6 p-8">
			<div>
				<Link
					to="/reviews"
					className="text-neutral-500 text-sm hover:text-neutral-900"
				>
					← Avis
				</Link>
				<h1 className="mt-2 font-bold text-3xl tracking-tight">
					Répondre à l'avis
				</h1>
			</div>

			<ReviewDetailCard review={review} establishment={establishment} />

			<section className="space-y-4">
				<div className="flex items-baseline justify-between gap-4">
					<h2 className="font-semibold text-lg">Brouillons de réponse</h2>
					<span className="text-neutral-500 text-sm">
						{responses.length === 0
							? "Aucun brouillon pour l'instant."
							: responses.length === 1
								? "1 brouillon"
								: `${responses.length} brouillons`}
					</span>
				</div>

				<GenerateDraftButton
					reviewId={review.id}
					defaultTone={establishment.defaultTone}
				/>

				{responses.length > 0 ? (
					<div className="space-y-3">
						{responses.map((response) => (
							<DraftCard key={response.id} response={response} />
						))}
					</div>
				) : null}
			</section>
		</main>
	);
}
