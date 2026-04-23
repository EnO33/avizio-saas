import { verifyWebhook } from "@clerk/backend/webhooks";
import { createFileRoute } from "@tanstack/react-router";
import { match } from "ts-pattern";
import { env } from "#/lib/env";
import { unknownToMessage } from "#/lib/errors";
import { logger } from "#/lib/logger";
import { fromPromise } from "#/lib/result";
import {
	handleMembershipDelete,
	handleMembershipUpsert,
	handleOrganizationDelete,
	handleOrganizationUpsert,
	handleSessionCreated,
	handleUnknownEvent,
	handleUserDelete,
	handleUserUpsert,
} from "#/server/webhooks/clerk-handlers";

export const Route = createFileRoute("/api/webhooks/clerk")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const verified = await fromPromise(
					verifyWebhook(request, {
						signingSecret: env.CLERK_WEBHOOK_SECRET,
					}),
					(e) => ({ kind: "invalid_signature" as const, cause: e }),
				);

				if (verified.isErr()) {
					logger.warn(
						{
							event: "clerk_webhook_verify_failed",
							message: unknownToMessage(verified.error.cause),
						},
						"Clerk webhook signature verification failed",
					);
					return new Response("Invalid signature", { status: 401 });
				}

				const evt = verified.value;
				const result = await match(evt)
					.with({ type: "user.created" }, ({ data }) => handleUserUpsert(data))
					.with({ type: "user.updated" }, ({ data }) => handleUserUpsert(data))
					.with({ type: "user.deleted" }, ({ data }) =>
						data.id ? handleUserDelete(data.id) : handleUnknownEvent(),
					)
					.with({ type: "organization.created" }, ({ data }) =>
						handleOrganizationUpsert(data),
					)
					.with({ type: "organization.updated" }, ({ data }) =>
						handleOrganizationUpsert(data),
					)
					.with({ type: "organization.deleted" }, ({ data }) =>
						data.id ? handleOrganizationDelete(data.id) : handleUnknownEvent(),
					)
					.with({ type: "organizationMembership.created" }, ({ data }) =>
						handleMembershipUpsert(data),
					)
					.with({ type: "organizationMembership.updated" }, ({ data }) =>
						handleMembershipUpsert(data),
					)
					.with({ type: "organizationMembership.deleted" }, ({ data }) =>
						handleMembershipDelete(data.id),
					)
					.with({ type: "session.created" }, ({ data }) =>
						handleSessionCreated(data),
					)
					.otherwise(() => handleUnknownEvent());

				if (result.isErr()) {
					logger.error(
						{
							event: "clerk_webhook_handler_failed",
							eventType: evt.type,
							error: result.error,
						},
						"Clerk webhook handler failed — returning 500 so Clerk retries",
					);
					return new Response("Handler failed", { status: 500 });
				}

				logger.info(
					{ event: "clerk_webhook_processed", eventType: evt.type },
					"Clerk webhook processed",
				);
				return Response.json({ ok: true });
			},
		},
	},
});
