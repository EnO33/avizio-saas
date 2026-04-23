export type ValidationIssue = {
	readonly path: readonly string[];
	readonly message: string;
};

export type ValidationError = {
	readonly kind: "validation_failed";
	readonly issues: readonly ValidationIssue[];
};

export type DbError =
	| { readonly kind: "db_not_found" }
	| { readonly kind: "db_unique_violation"; readonly constraint: string | null }
	| {
			readonly kind: "db_foreign_key_violation";
			readonly constraint: string | null;
	  }
	| {
			readonly kind: "db_not_null_violation";
			readonly column: string | null;
	  }
	| {
			readonly kind: "db_check_violation";
			readonly constraint: string | null;
	  }
	| { readonly kind: "db_connection_failed"; readonly message: string }
	| { readonly kind: "db_unknown"; readonly message: string };

export type AuthError =
	| { readonly kind: "unauthenticated" }
	| { readonly kind: "forbidden"; readonly reason?: string }
	| { readonly kind: "org_membership_required" };

export type RateLimitError = {
	readonly kind: "rate_limited";
	readonly retryAfterMs: number;
};

export type IntegrationError =
	| {
			readonly kind: "integration_unauthorized";
			readonly provider: string;
	  }
	| {
			readonly kind: "integration_rate_limited";
			readonly provider: string;
			readonly retryAfterMs: number;
	  }
	| { readonly kind: "integration_timeout"; readonly provider: string }
	| {
			readonly kind: "integration_network";
			readonly provider: string;
			readonly message: string;
	  }
	| {
			readonly kind: "integration_http_error";
			readonly provider: string;
			readonly status: number;
			readonly body: string;
	  }
	| {
			readonly kind: "integration_invalid_response";
			readonly provider: string;
			readonly issues: readonly ValidationIssue[];
	  };

export type OAuthError =
	| { readonly kind: "oauth_state_invalid_format" }
	| { readonly kind: "oauth_state_signature_mismatch" }
	| { readonly kind: "oauth_state_expired" }
	| { readonly kind: "oauth_state_payload_invalid" }
	| { readonly kind: "oauth_callback_missing_code" }
	| { readonly kind: "oauth_callback_missing_state" }
	| { readonly kind: "oauth_callback_user_denied"; readonly reason: string }
	| {
			readonly kind: "oauth_token_exchange_failed";
			readonly status: number;
			readonly body: string;
	  }
	| {
			readonly kind: "oauth_token_exchange_invalid_response";
			readonly issues: readonly ValidationIssue[];
	  }
	| { readonly kind: "oauth_id_token_invalid" };

export type UnknownError = {
	readonly kind: "unknown";
	readonly message: string;
};

export function unknownToMessage(e: unknown): string {
	if (e instanceof Error) return e.message;
	if (typeof e === "string") return e;
	return String(e);
}
