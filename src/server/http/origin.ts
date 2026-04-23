import {
	getRequestHost,
	getRequestProtocol,
} from "@tanstack/react-start/server";

/**
 * Scheme + host of the current inbound request. Honors `x-forwarded-*`
 * headers so we pick the public-facing origin when running behind Vercel's
 * edge proxy (and similar serverless setups) rather than the internal host.
 *
 * Must only be called from within a request context (server fn handler,
 * route loader, API route handler). Outside of one it throws.
 */
export function getRequestOrigin(): string {
	const proto = getRequestProtocol({ xForwardedProto: true });
	const host = getRequestHost({ xForwardedHost: true });
	return `${proto}://${host}`;
}
