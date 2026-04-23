import type { BusinessType, Tone } from "#/server/db/queries/establishments";
import { RatingStars } from "./rating-stars";
import { ReviewStatusBadge } from "./status-badge";

const BUSINESS_TYPE_FR: Record<BusinessType, string> = {
	restaurant: "Restaurant",
	hotel: "Hôtel",
	cafe: "Café",
	bar: "Bar",
	bakery: "Boulangerie",
	artisan: "Artisan",
	retail: "Commerce",
	other: "Autre",
};

const TONE_FR: Record<Tone, string> = {
	warm: "Chaleureux",
	professional: "Professionnel",
	direct: "Direct",
};

export type ReviewDetailProps = {
	readonly review: {
		readonly id: string;
		readonly authorName: string;
		readonly rating: number;
		readonly content: string;
		readonly status: "new" | "in_progress" | "responded" | "skipped";
	};
	readonly establishment: {
		readonly id: string;
		readonly name: string;
		readonly city: string;
		readonly businessType: BusinessType;
		readonly defaultTone: Tone;
	};
};

export function ReviewDetailCard({ review, establishment }: ReviewDetailProps) {
	return (
		<article className="space-y-4 rounded-lg border border-neutral-200 bg-white p-6">
			<div className="flex items-start justify-between gap-4">
				<div className="min-w-0">
					<div className="font-semibold text-lg text-neutral-900">
						{review.authorName}
					</div>
					<div className="mt-1 flex flex-wrap items-center gap-2 text-neutral-500 text-xs">
						<RatingStars value={review.rating} />
						<span>·</span>
						<span>{review.rating}/5</span>
					</div>
				</div>
				<ReviewStatusBadge status={review.status} />
			</div>

			<p className="whitespace-pre-wrap text-neutral-800 text-sm">
				{review.content.trim().length > 0
					? review.content
					: "(le client n'a pas laissé de texte)"}
			</p>

			<div className="border-neutral-100 border-t pt-4 text-neutral-500 text-xs">
				<div>
					<span className="font-medium text-neutral-700">
						{establishment.name}
					</span>
					{" — "}
					{BUSINESS_TYPE_FR[establishment.businessType]} à {establishment.city}
				</div>
				<div className="mt-1">
					Ton par défaut de l'établissement :{" "}
					{TONE_FR[establishment.defaultTone]}
				</div>
			</div>
		</article>
	);
}
