import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { DbError } from "#/lib/errors";
import { unknownToMessage } from "#/lib/errors";
import { err, fromPromise, ok, type Result } from "#/lib/result";
import { db } from "../client";
import { establishments, responses, reviews } from "../schema";

/**
 * Tout ce que le dashboard affiche, calculé côté DB. Regroupé dans un
 * module dédié plutôt qu'éclaté entre `reviews.ts` et `responses.ts`
 * parce que toutes ces métriques partagent la même fenêtre temporelle
 * (mois courant vs mois précédent pour les deltas) et qu'il est plus
 * lisible de les lire côte à côte — on voit tout de suite qu'elles
 * sont cohérentes entre elles.
 */

// ─── KPIs (mois courant vs précédent) ─────────────────────────────────────

export type DashboardKpis = {
	/** `null` si aucun avis n'a été publié dans la fenêtre. */
	readonly avgRating: number | null;
	/** Delta en étoiles vs mois précédent. `null` si une des fenêtres est vide. */
	readonly avgRatingDelta: number | null;

	readonly reviewCount: number;
	/** Delta absolu vs mois précédent. */
	readonly reviewCountDelta: number;

	/** Taux de réponse 0..1 pour les avis de la fenêtre. `null` si zéro avis. */
	readonly responseRate: number | null;
	/** Delta en points (0.08 = +8 pt). `null` si une des fenêtres est vide. */
	readonly responseRateDelta: number | null;

	/**
	 * Temps médian entre l'avis et la réponse approuvée, en minutes.
	 * `null` si aucune réponse approuvée dans la fenêtre.
	 */
	readonly medianResponseTimeMinutes: number | null;
	readonly medianResponseTimeDeltaMinutes: number | null;
};

type WindowAggregates = {
	readonly avgRating: number | null;
	readonly reviewCount: number;
	readonly responseRate: number | null;
	readonly medianResponseTimeMinutes: number | null;
};

function toDbError(e: unknown): DbError {
	return { kind: "db_unknown", message: unknownToMessage(e) };
}

/**
 * Agrégats pour une fenêtre temporelle [from, until) : note moyenne,
 * nombre d'avis, taux de réponse, temps médian de réponse. Une seule
 * query pour les quatre — tous passent par le même JOIN reviews +
 * establishments + (optionnel) responses, autant ne parcourir les
 * tables qu'une fois.
 */
async function getWindowAggregates(
	organizationId: string,
	from: Date,
	until: Date,
): Promise<Result<WindowAggregates, DbError>> {
	// Note : on calcule `responseRate` en comptant les reviews.status =
	// 'responded' (signal qui bouge quand l'user approuve un draft via
	// `approveResponseFn`) et non les rows `responses`. Les drafts non
	// approuvés ne doivent pas compter comme une réponse.
	//
	// Deux queries séparées :
	// 1. Les agrégats simples sur `reviews` — pas de join responses pour
	//    ne pas dupliquer les rows (un avis peut avoir plusieurs drafts).
	// 2. La médiane nécessite les timestamps de réponse, donc un join,
	//    mais on passe par une sous-requête qui réduit responses à une
	//    ligne par review (MIN(updated_at) de la première approbation)
	//    pour éviter la duplication.
	const [coreResult, medianResult] = await Promise.all([
		fromPromise(
			db
				.select({
					avgRating: sql<
						string | null
					>`AVG(${reviews.rating})::numeric(4,2)`.as("avg_rating"),
					reviewCount: sql<number>`COUNT(${reviews.id})::int`.as(
						"review_count",
					),
					respondedCount: sql<number>`
						COUNT(${reviews.id}) FILTER (WHERE ${reviews.status} = 'responded')::int
					`.as("responded_count"),
				})
				.from(reviews)
				.innerJoin(
					establishments,
					eq(reviews.establishmentId, establishments.id),
				)
				.where(
					and(
						eq(establishments.organizationId, organizationId),
						gte(reviews.publishedAt, from),
						lt(reviews.publishedAt, until),
					),
				),
			toDbError,
		),
		fromPromise(
			db.execute(
				sql`
					SELECT percentile_cont(0.5) WITHIN GROUP (
						ORDER BY EXTRACT(EPOCH FROM (resp.first_approved_at - rev.published_at)) / 60
					) AS median_minutes
					FROM reviews rev
					INNER JOIN establishments est ON rev.establishment_id = est.id
					INNER JOIN (
						SELECT review_id, MIN(updated_at) AS first_approved_at
						FROM responses
						WHERE status IN ('approved', 'published')
						GROUP BY review_id
					) resp ON resp.review_id = rev.id
					WHERE est.organization_id = ${organizationId}
						AND rev.published_at >= ${from}
						AND rev.published_at < ${until}
				`,
			),
			toDbError,
		),
	]);

	if (coreResult.isErr()) return err(coreResult.error);
	if (medianResult.isErr()) return err(medianResult.error);

	const coreRow = coreResult.value[0];
	const medianRows = unwrapRows<{ median_minutes: string | null }>(
		medianResult.value,
	);
	const medianRaw = medianRows[0]?.median_minutes ?? null;

	if (!coreRow) {
		return ok({
			avgRating: null,
			reviewCount: 0,
			responseRate: null,
			medianResponseTimeMinutes: null,
		});
	}

	const reviewCount = coreRow.reviewCount;
	return ok({
		avgRating: coreRow.avgRating != null ? Number(coreRow.avgRating) : null,
		reviewCount,
		responseRate: reviewCount > 0 ? coreRow.respondedCount / reviewCount : null,
		medianResponseTimeMinutes: medianRaw != null ? Number(medianRaw) : null,
	});
}

/*
  `db.execute(sql)` renvoie un objet dont la forme varie entre le driver
  pg natif et Neon serverless — parfois `{ rows: [...] }`, parfois
  directement `[...]`. On normalise en un tableau typé, en faisant
  confiance au caller pour la shape de chaque row.
*/
function unwrapRows<T>(result: unknown): readonly T[] {
	if (Array.isArray(result)) return result as readonly T[];
	if (result && typeof result === "object" && "rows" in result) {
		const rows = (result as { rows?: unknown }).rows;
		if (Array.isArray(rows)) return rows as readonly T[];
	}
	return [];
}

/**
 * KPIs mois courant + deltas vs mois précédent. Retourne des deltas
 * null quand l'une des fenêtres est vide — les deltas n'ont pas de
 * sens quand on compare « 5 avis » à « 0 avis » en taux.
 */
export async function getDashboardKpisForOrg(
	organizationId: string,
): Promise<Result<DashboardKpis, DbError>> {
	const now = new Date();
	const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
	const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
	const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

	const [currentResult, previousResult] = await Promise.all([
		getWindowAggregates(organizationId, thisMonthStart, nextMonthStart),
		getWindowAggregates(organizationId, prevMonthStart, thisMonthStart),
	]);

	if (currentResult.isErr()) return err(currentResult.error);
	if (previousResult.isErr()) return err(previousResult.error);

	const current = currentResult.value;
	const previous = previousResult.value;

	const avgRatingDelta =
		current.avgRating != null && previous.avgRating != null
			? current.avgRating - previous.avgRating
			: null;

	const reviewCountDelta = current.reviewCount - previous.reviewCount;

	const responseRateDelta =
		current.responseRate != null && previous.responseRate != null
			? current.responseRate - previous.responseRate
			: null;

	const medianResponseTimeDeltaMinutes =
		current.medianResponseTimeMinutes != null &&
		previous.medianResponseTimeMinutes != null
			? current.medianResponseTimeMinutes - previous.medianResponseTimeMinutes
			: null;

	return ok({
		avgRating: current.avgRating,
		avgRatingDelta,
		reviewCount: current.reviewCount,
		reviewCountDelta,
		responseRate: current.responseRate,
		responseRateDelta,
		medianResponseTimeMinutes: current.medianResponseTimeMinutes,
		medianResponseTimeDeltaMinutes,
	});
}

// ─── Spark chart (30 points quotidiens sur 30 jours) ──────────────────────

export type SparkPoint = {
	readonly day: Date;
	readonly avgRating: number | null;
};

/**
 * Moyenne quotidienne sur les 30 derniers jours. On `generate_series`
 * la liste des jours pour avoir un axe X continu même quand certaines
 * journées n'ont pas d'avis — le chart décide ensuite comment
 * représenter les nulls (ligne interrompue ou forward-fill).
 */
export async function getSparkSeriesForOrg(
	organizationId: string,
): Promise<Result<readonly SparkPoint[], DbError>> {
	const rowsResult = await fromPromise(
		db.execute(
			sql`
				WITH days AS (
					SELECT generate_series(
						date_trunc('day', now()) - INTERVAL '29 days',
						date_trunc('day', now()),
						INTERVAL '1 day'
					)::date AS day
				)
				SELECT
					d.day::text AS day,
					AVG(rev.rating)::numeric(4,2) AS avg_rating
				FROM days d
				LEFT JOIN reviews rev
					ON date_trunc('day', rev.published_at)::date = d.day
				LEFT JOIN establishments est
					ON rev.establishment_id = est.id
					AND est.organization_id = ${organizationId}
				WHERE rev.id IS NULL OR est.organization_id = ${organizationId}
				GROUP BY d.day
				ORDER BY d.day ASC
			`,
		),
		toDbError,
	);

	return rowsResult.map((result) => {
		const rows = unwrapRows<{ day: string; avg_rating: string | null }>(result);
		return rows.map((r) => ({
			day: new Date(r.day),
			avgRating: r.avg_rating != null ? Number(r.avg_rating) : null,
		}));
	});
}

// ─── AI summary (7 derniers jours) ────────────────────────────────────────

export type AiSummary = {
	/** Brouillons IA créés par Avizio dans les 7 derniers jours. */
	readonly draftsThisWeek: number;
	/**
	 * Minutes économisées estimées. Proxy fixe : 3 min par brouillon
	 * généré (temps moyen de rédaction manuelle). Swappé pour une vraie
	 * mesure le jour où on track le temps passé dans l'éditeur.
	 */
	readonly timeSavedMinutes: number;
};

export async function getAiSummaryForOrg(
	organizationId: string,
): Promise<Result<AiSummary, DbError>> {
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	const result = await fromPromise(
		db
			.select({
				draftsThisWeek: sql<number>`COUNT(${responses.id})::int`,
			})
			.from(responses)
			.innerJoin(reviews, eq(responses.reviewId, reviews.id))
			.innerJoin(establishments, eq(reviews.establishmentId, establishments.id))
			.where(
				and(
					eq(establishments.organizationId, organizationId),
					eq(responses.aiGenerated, true),
					gte(responses.createdAt, sevenDaysAgo),
				),
			),
		toDbError,
	);

	return result.map((rows) => {
		const draftsThisWeek = rows[0]?.draftsThisWeek ?? 0;
		return {
			draftsThisWeek,
			timeSavedMinutes: draftsThisWeek * 3,
		};
	});
}
