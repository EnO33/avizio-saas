import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Filter } from "lucide-react";
import { z } from "zod";
import { EmptyInbox, EmptyPreview } from "#/components/reviews/empty-inbox";
import { InboxPreview } from "#/components/reviews/inbox-preview";
import { InboxRow } from "#/components/reviews/inbox-row";
import { Tabs } from "#/components/ui/tabs";
import { listConnections } from "#/server/fns/connections";
import { listEstablishments } from "#/server/fns/establishments";
import { listReviews } from "#/server/fns/reviews";

const STATUS_VALUES = [
	"new",
	"in_progress",
	"responded",
	"skipped",
	"all",
] as const;
type StatusFilter = (typeof STATUS_VALUES)[number];

const PLATFORM_VALUES = ["all", "google", "tripadvisor", "trustpilot"] as const;
type PlatformFilter = (typeof PLATFORM_VALUES)[number];

const searchSchema = z.object({
	status: z.enum(STATUS_VALUES).default("new"),
	platform: z.enum(PLATFORM_VALUES).default("all"),
	id: z.string().optional(),
});

export const Route = createFileRoute("/_authed/reviews/")({
	validateSearch: searchSchema,
	loader: async () => {
		const [reviews, connections, establishments] = await Promise.all([
			listReviews(),
			listConnections(),
			listEstablishments(),
		]);
		return { reviews, connections, establishments };
	},
	component: ReviewsInbox,
});

function ReviewsInbox() {
	const { reviews, connections, establishments } = Route.useLoaderData();
	const { status, platform, id } = Route.useSearch();
	const navigate = useNavigate();

	const hasConnection = connections.length > 0;
	const filtered = reviews
		.filter((r) => (status === "all" ? true : r.status === status))
		.filter((r) => (platform === "all" ? true : r.platform === platform));

	const selected =
		(id ? filtered.find((r) => r.id === id) : null) ?? filtered[0] ?? null;
	const selectedEstablishment = selected
		? (establishments.find((e) => e.id === selected.establishmentId) ?? null)
		: null;

	/*
	  Counts par statut — recalculés à partir de `reviews` brut (ignorent
	  le filtre plateforme actif, intentionnel : les compteurs d'onglet
	  donnent une vue globale « il y a N nouveaux toutes plateformes
	  confondues », changer de plateforme ne doit pas les faire bouger).
	*/
	const countBy = (s: StatusFilter) =>
		s === "all" ? undefined : reviews.filter((r) => r.status === s).length;

	const setSearch = (next: {
		status?: StatusFilter;
		platform?: PlatformFilter;
		id?: string | undefined;
	}) => {
		navigate({
			to: "/reviews",
			search: (prev) => ({ ...prev, ...next }),
			replace: true,
		});
	};

	/*
	  En desktop (`lg:`, ≥ 1024px), cliquer une row met à jour le param `id`
	  pour afficher l'avis dans le panneau preview. En mobile ce panneau est
	  caché — on navigue plutôt vers `/reviews/$id` pour ouvrir la page
	  complète de réponse. La bascule se fait à l'exécution via matchMedia :
	  plus simple qu'un hook de viewport réactif, et suffisant pour un
	  onClick — au rendu initial la preview est déjà gérée par les classes
	  responsive.
	*/
	const handleSelectReview = (reviewId: string) => {
		const isDesktop =
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 1024px)").matches;
		if (isDesktop) {
			setSearch({ id: reviewId });
			return;
		}
		navigate({ to: "/reviews/$id", params: { id: reviewId } });
	};

	return (
		<div className="grid grid-cols-1 lg:h-[calc(100vh-60px)] lg:grid-cols-[minmax(380px,440px)_1fr]">
			{/* List column */}
			<div className="flex min-w-0 flex-col lg:border-line-soft lg:border-r">
				<div className="px-4 pt-5 md:px-[22px]">
					<div className="mb-3.5 flex items-baseline justify-between">
						<h1 className="m-0 font-serif font-normal text-[28px] tracking-[-0.02em]">
							Boîte de réponses
						</h1>
						<button
							type="button"
							aria-label="Filtres avancés — bientôt"
							className="-mr-2 inline-flex size-10 items-center justify-center rounded-md text-ink-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-40"
							disabled
						>
							<Filter size={16} strokeWidth={1.75} />
						</button>
					</div>

					<PlatformPills
						value={platform}
						onChange={(p) => setSearch({ platform: p, id: undefined })}
					/>
				</div>

				<div className="px-4 md:px-[22px]">
					<Tabs
						tabs={[
							{ id: "new", label: "Nouveaux", count: countBy("new") },
							{
								id: "in_progress",
								label: "En cours",
								count: countBy("in_progress"),
							},
							{
								id: "responded",
								label: "Répondus",
								count: countBy("responded"),
							},
							{ id: "skipped", label: "Ignorés", count: countBy("skipped") },
							{ id: "all", label: "Tous" },
						]}
						value={status}
						onChange={(s) => setSearch({ status: s, id: undefined })}
					/>
				</div>

				<div className="flex-1 px-3.5 pt-1.5 pb-5 lg:overflow-auto">
					{filtered.length === 0 ? (
						<EmptyInbox hasConnection={hasConnection} />
					) : (
						filtered.map((review) => (
							<InboxRow
								key={review.id}
								review={review}
								selected={selected?.id === review.id}
								onSelect={() => handleSelectReview(review.id)}
							/>
						))
					)}
				</div>
			</div>

			{/* Preview pane — caché en mobile, la navigation par row bascule sur /reviews/$id */}
			<div className="hidden min-w-0 lg:block lg:overflow-auto">
				{selected ? (
					<InboxPreview
						review={selected}
						establishment={selectedEstablishment}
					/>
				) : (
					<EmptyPreview />
				)}
			</div>
		</div>
	);
}

type PlatformPillsProps = {
	readonly value: PlatformFilter;
	readonly onChange: (next: PlatformFilter) => void;
};

const PILL_LABELS: Record<PlatformFilter, string> = {
	all: "Toutes plateformes",
	google: "Google",
	tripadvisor: "TripAdvisor",
	trustpilot: "Trustpilot",
};

function PlatformPills({ value, onChange }: PlatformPillsProps) {
	return (
		<div className="-mx-4 md:-mx-0 mb-2.5 flex gap-1.5 overflow-x-auto px-4 md:flex-wrap md:overflow-visible md:px-0">
			{PLATFORM_VALUES.map((p) => {
				const active = value === p;
				return (
					<button
						key={p}
						type="button"
						onClick={() => onChange(p)}
						aria-pressed={active}
						className={[
							"shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
							active
								? "border-ink bg-ink text-bg"
								: "border-line bg-paper text-ink-soft hover:text-ink",
						].join(" ")}
					>
						{PILL_LABELS[p]}
					</button>
				);
			})}
		</div>
	);
}
