import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ResponseApprovedConfirm } from "#/components/reviews/response-approved-confirm";
import { ResponseHistoryDrawer } from "#/components/reviews/response-history-drawer";
import { ResponseLeftPanel } from "#/components/reviews/response-left-panel";
import { ResponseRightPanel } from "#/components/reviews/response-right-panel";
import { getReviewDetail } from "#/server/fns/responses";

export const Route = createFileRoute("/_authed/reviews/$id")({
	loader: async ({ params }) => ({
		detail: await getReviewDetail({ data: { id: params.id } }),
	}),
	component: ReviewDetailPage,
});

function ReviewDetailPage() {
	const { detail } = Route.useLoaderData();
	const [historyOpen, setHistoryOpen] = useState(false);
	const [justPublished, setJustPublished] = useState(false);

	if (!detail) return <ReviewNotFound />;

	const { review, establishment, responses } = detail;

	if (justPublished) {
		return <ResponseApprovedConfirm review={review} />;
	}

	return (
		<div
			className="grid"
			style={{
				gridTemplateColumns: "1fr 1fr",
				minHeight: "calc(100vh - 60px)",
			}}
		>
			<ResponseLeftPanel review={review} />
			<ResponseRightPanel
				review={review}
				drafts={responses}
				defaultTone={establishment.defaultTone}
				onPublished={() => setJustPublished(true)}
				onOpenHistory={() => setHistoryOpen(true)}
			/>

			<ResponseHistoryDrawer
				open={historyOpen}
				review={review}
				drafts={responses}
				onClose={() => setHistoryOpen(false)}
			/>
		</div>
	);
}

function ReviewNotFound() {
	return (
		<main className="mx-auto max-w-[560px] space-y-4 p-10">
			<Link
				to="/reviews"
				className="text-[12.5px] text-ink-soft hover:text-ink"
			>
				← Boîte de réponses
			</Link>
			<div className="rounded-lg border border-[oklch(0.88_0.04_25)] bg-[oklch(0.95_0.03_25)] p-6">
				<h1 className="font-serif text-[22px] text-[oklch(0.4_0.12_25)]">
					Avis introuvable
				</h1>
				<p className="mt-1 text-[13px] text-[oklch(0.45_0.12_25)]">
					Il a peut-être été supprimé, ou ne fait pas partie de votre
					organisation active.
				</p>
			</div>
		</main>
	);
}
