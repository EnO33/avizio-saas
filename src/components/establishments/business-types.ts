import type { BusinessType } from "#/server/db/queries/establishments";

/**
 * Ordered list + French labels for the `business_type` enum. The form select
 * and the list row share this so any addition to the enum propagates in one
 * place.
 */
export const BUSINESS_TYPE_OPTIONS: ReadonlyArray<{
	readonly value: BusinessType;
	readonly label: string;
}> = [
	{ value: "restaurant", label: "Restaurant" },
	{ value: "hotel", label: "Hôtel" },
	{ value: "cafe", label: "Café" },
	{ value: "bar", label: "Bar" },
	{ value: "bakery", label: "Boulangerie" },
	{ value: "artisan", label: "Artisan" },
	{ value: "retail", label: "Commerce" },
	{ value: "other", label: "Autre" },
];

const LABEL_BY_TYPE: Record<BusinessType, string> = Object.fromEntries(
	BUSINESS_TYPE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<BusinessType, string>;

export function businessTypeLabel(type: BusinessType): string {
	return LABEL_BY_TYPE[type];
}
