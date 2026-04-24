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

	return (
		<div
			className="grid"
			style={{
				gridTemplateColumns: "minmax(380px, 440px) 1fr",
				height: "calc(100vh - 60px)",
			}}
		>
			{/* List column */}
			<div className="flex min-w-0 flex-col border-line-soft border-r">
				<div className="px-[22px] pt-5">
					<div className="mb-3.5 flex items-baseline justify-between">
						<h1 className="m-0 font-serif font-normal text-[28px] tracking-[-0.02em]">
							Boîte de réponses
						</h1>
						<button
							type="button"
							aria-label="Filtres avancés — bientôt"
							className="p-1.5 text-ink-mute hover:text-ink"
							disabled
						>
							<Filter size={15} strokeWidth={1.75} />
						</button>
					</div>

					<PlatformPills
						value={platform}
						onChange={(p) => setSearch({ platform: p, id: undefined })}
					/>
				</div>

				<div className="px-[22px]">
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

				<div className="flex-1 overflow-auto px-3.5 pt-1.5 pb-5">
					{filtered.length === 0 ? (
						<EmptyInbox hasConnection={hasConnection} />
					) : (
						filtered.map((review) => (
							<InboxRow
								key={review.id}
								review={review}
								selected={selected?.id === review.id}
								onSelect={() => setSearch({ id: review.id })}
							/>
						))
					)}
				</div>
			</div>

			{/* Preview pane */}
			<div className="min-w-0 overflow-auto">
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
		<div className="mb-2.5 flex flex-wrap gap-1.5">
			{PLATFORM_VALUES.map((p) => {
				const active = value === p;
				return (
					<button
						key={p}
						type="button"
						onClick={() => onChange(p)}
						aria-pressed={active}
						className={[
							"rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
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
