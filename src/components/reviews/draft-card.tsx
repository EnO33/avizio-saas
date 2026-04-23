import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import type { Tone } from "#/server/db/queries/establishments";
import type { ResponseSummary } from "#/server/db/queries/responses";
import {
	approveResponseFn,
	updateResponseContentFn,
} from "#/server/fns/responses";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
	dateStyle: "medium",
	timeStyle: "short",
});

const TONE_FR: Record<Tone, string> = {
	warm: "chaleureux",
	professional: "professionnel",
	direct: "direct",
};

const STATUS_STYLES: Record<
	ResponseSummary["status"],
	{ readonly border: string; readonly badge: string; readonly label: string }
> = {
	draft: {
		border: "border-neutral-200",
		badge: "bg-neutral-100 text-neutral-700",
		label: "Brouillon",
	},
	approved: {
		border: "border-emerald-200",
		badge: "bg-emerald-100 text-emerald-800",
		label: "Approuvé",
	},
	published: {
		border: "border-blue-200",
		badge: "bg-blue-100 text-blue-800",
		label: "Publié",
	},
	failed: {
		border: "border-red-200",
		badge: "bg-red-100 text-red-800",
		label: "Échec publication",
	},
};

export function DraftCard({ response }: { response: ResponseSummary }) {
	const router = useRouter();
	const [content, setContent] = useState(response.content);
	const [isPending, setIsPending] = useState<"save" | "approve" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const styles = STATUS_STYLES[response.status];
	const isDirty = content !== response.content;
	const isLocked = response.status === "published";

	const onSave = async () => {
		setError(null);
		setIsPending("save");
		const result = await updateResponseContentFn({
			data: { id: response.id, content },
		});
		setIsPending(null);
		if (result.kind === "ok") {
			await router.invalidate();
			return;
		}
		setError(
			result.kind === "not_found"
				? "Ce brouillon n'existe plus."
				: result.kind === "unauthenticated"
					? "Ta session a expiré."
					: "Impossible d'enregistrer. Réessaie.",
		);
	};

	const onApprove = async () => {
		// If there are unsaved edits, persist them first — otherwise the
		// approve operates on the stale stored content.
		if (isDirty) {
			await onSave();
		}
		setError(null);
		setIsPending("approve");
		const result = await approveResponseFn({ data: { id: response.id } });
		setIsPending(null);
		if (result.kind === "ok") {
			await router.invalidate();
			return;
		}
		setError(
			result.kind === "not_found"
				? "Ce brouillon ne peut plus être approuvé (peut-être déjà approuvé ailleurs)."
				: result.kind === "unauthenticated"
					? "Ta session a expiré."
					: "Impossible d'approuver. Réessaie.",
		);
	};

	return (
		<article
			className={`space-y-3 rounded-md border bg-white p-4 ${styles.border}`}
		>
			<div className="flex flex-wrap items-center gap-2 text-neutral-500 text-xs">
				<span
					className={`rounded-full px-2 py-0.5 font-medium ${styles.badge}`}
				>
					{styles.label}
				</span>
				{response.aiGenerated ? (
					<span className="rounded-full bg-neutral-100 px-2 py-0.5">IA</span>
				) : null}
				<span>·</span>
				<span>Ton {TONE_FR[response.tone]}</span>
				<span>·</span>
				<time dateTime={new Date(response.createdAt).toISOString()}>
					Généré le {dateFormatter.format(new Date(response.createdAt))}
				</time>
				{response.modelId ? (
					<>
						<span>·</span>
						<span>
							{response.modelId}
							{response.promptVersion ? ` / ${response.promptVersion}` : ""}
						</span>
					</>
				) : null}
			</div>

			<textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				disabled={isLocked || isPending !== null}
				rows={5}
				maxLength={5000}
				className="block w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-900 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:cursor-not-allowed disabled:bg-neutral-50"
			/>

			{error ? (
				<p className="rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm">
					{error}
				</p>
			) : null}

			{!isLocked ? (
				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={onSave}
						disabled={!isDirty || isPending !== null}
						className="rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-medium text-neutral-700 text-sm transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isPending === "save" ? "Enregistrement…" : "Enregistrer"}
					</button>
					{response.status === "draft" ? (
						<button
							type="button"
							onClick={onApprove}
							disabled={isPending !== null}
							className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-sm text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{isPending === "approve"
								? "Approbation…"
								: "Approuver ce brouillon"}
						</button>
					) : null}
				</div>
			) : null}
		</article>
	);
}
