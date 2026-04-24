import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { logger } from "#/lib/logger";
import {
	type AiSummary,
	type DashboardKpis,
	getAiSummaryForOrg,
	getDashboardKpisForOrg,
	getSparkSeriesForOrg,
	type SparkPoint,
} from "#/server/db/queries/dashboard";

const EMPTY_KPIS: DashboardKpis = {
	avgRating: null,
	avgRatingDelta: null,
	reviewCount: 0,
	reviewCountDelta: 0,
	responseRate: null,
	responseRateDelta: null,
	medianResponseTimeMinutes: null,
	medianResponseTimeDeltaMinutes: null,
};

const EMPTY_SUMMARY: AiSummary = { draftsThisWeek: 0, timeSavedMinutes: 0 };

export type DashboardMetrics = {
	readonly kpis: DashboardKpis;
	readonly spark: readonly SparkPoint[];
	readonly aiSummary: AiSummary;
};

/**
 * Agrégats du dashboard — KPIs (note moyenne, volume, taux réponse,
 * temps médian), séries quotidiennes pour le spark chart, et résumé
 * hebdo IA. Trois queries en parallèle, même session/org pour chacune.
 *
 * Fallback sur des valeurs neutres (null / 0) quand l'org est vide ou
 * qu'une query échoue — le dashboard reste rendable sans planter. Les
 * logs capturent quand même les échecs pour éviter de masquer une
 * panne silencieuse.
 */
export const getDashboardMetrics = createServerFn().handler(
	async (): Promise<DashboardMetrics> => {
		const session = await auth();
		if (!session.isAuthenticated || !session.orgId) {
			return { kpis: EMPTY_KPIS, spark: [], aiSummary: EMPTY_SUMMARY };
		}

		const [kpisResult, sparkResult, summaryResult] = await Promise.all([
			getDashboardKpisForOrg(session.orgId),
			getSparkSeriesForOrg(session.orgId),
			getAiSummaryForOrg(session.orgId),
		]);

		if (kpisResult.isErr()) {
			logger.error(
				{
					event: "dashboard_kpis_failed",
					kind: kpisResult.error.kind,
					orgId: session.orgId,
				},
				"Failed to compute dashboard KPIs",
			);
		}
		if (sparkResult.isErr()) {
			logger.error(
				{
					event: "dashboard_spark_failed",
					kind: sparkResult.error.kind,
					orgId: session.orgId,
				},
				"Failed to compute dashboard spark series",
			);
		}
		if (summaryResult.isErr()) {
			logger.error(
				{
					event: "dashboard_ai_summary_failed",
					kind: summaryResult.error.kind,
					orgId: session.orgId,
				},
				"Failed to compute dashboard AI summary",
			);
		}

		return {
			kpis: kpisResult.isOk() ? kpisResult.value : EMPTY_KPIS,
			spark: sparkResult.isOk() ? sparkResult.value : [],
			aiSummary: summaryResult.isOk() ? summaryResult.value : EMPTY_SUMMARY,
		};
	},
);
