const STAR_ON = "text-amber-400";
const STAR_OFF = "text-neutral-200";

/**
 * Visual 1..5 star rating. Purely presentational — does not handle clicks
 * or half-stars (all platforms we support round to integers).
 */
export function RatingStars({ value }: { value: number }) {
	const clamped = Math.max(0, Math.min(5, Math.round(value)));
	return (
		<div
			role="img"
			aria-label={`${clamped} étoiles sur 5`}
			className="flex items-center gap-0.5"
		>
			{[1, 2, 3, 4, 5].map((n) => (
				<span
					key={n}
					aria-hidden="true"
					className={`text-sm leading-none ${n <= clamped ? STAR_ON : STAR_OFF}`}
				>
					★
				</span>
			))}
		</div>
	);
}
