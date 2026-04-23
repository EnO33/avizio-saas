/**
 * Extract a user-facing message from a Clerk error.
 *
 * Clerk errors come in a few shapes across the Signal API:
 * - A direct object with `{ code, message, longMessage? }` (ClerkAPIError)
 * - A wrapper `{ errors: ClerkAPIError[] }`
 * - A generic `Error` instance
 *
 * Returns `fallback` if none of the known shapes match.
 */
export function clerkErrorToMessage(err: unknown, fallback: string): string {
	if (!err) return fallback;
	if (err instanceof Error) return err.message;
	if (typeof err !== "object") return fallback;

	if ("message" in err && typeof err.message === "string" && err.message) {
		return err.message;
	}
	if ("errors" in err && Array.isArray(err.errors) && err.errors.length > 0) {
		const first: unknown = err.errors[0];
		if (
			first &&
			typeof first === "object" &&
			"message" in first &&
			typeof first.message === "string" &&
			first.message
		) {
			return first.message;
		}
	}
	return fallback;
}
