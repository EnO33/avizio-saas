import { useRouter } from "@tanstack/react-router";
import { History, Send, Sparkles, Wand2 } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { ChoiceCard } from "#/components/ui/choice-card";
import { PLATFORM_LABELS } from "#/components/ui/platform-icon";
import type { Tone } from "#/server/db/queries/establishments";
import type { ResponseSummary } from "#/server/db/queries/responses";
import type { ReviewSummary } from "#/server/db/queries/reviews";
import {
	approveResponseFn,
	generateResponseDraftFn,
	updateResponseContentFn,
} from "#/server/fns/responses";
import { generateResultToMessage } from "./generate-result-message";

const TONE_OPTIONS: ReadonlyArray<{
	readonly value: Tone;
	readonly label: string;
	readonly subtitle: string;
}> = [
	{ value: "warm", label: "Chaleureux", subtitle: "Proche, personnel" },
	{
		value: "professional",
		label: "Professionnel",
		subtitle: "Courtois, mesuré",
	},
	{ value: "direct", label: "Direct", subtitle: "Concis, factuel" },
];

const MAX_CONTENT_LENGTH = 5000;

type Props = {
	readonly review: ReviewSummary;
	/** Brouillons existants triés par date de création croissante (v1 → vN). */
	readonly drafts: readonly ResponseSummary[];
	readonly defaultTone: Tone;
	readonly onPublished: () => void;
	readonly onOpenHistory: () => void;
};

/**
 * Colonne droite — l'éditeur de brouillon. Gère :
 *
 * - État actif (`activeIdx`) : quel brouillon est édité. Init au dernier,
 *   synchronisé si `drafts` change (ex. après une régénération qui
 *   ajoute un nouveau brouillon, on bascule automatiquement dessus).
 * - Contenu dirty : compare au contenu stocké du brouillon actif, pour
 *   activer « Modifications non enregistrées ».
 * - Régénération : shimmer overlay pendant l'appel à
 *   `generateResponseDraftFn`. À succès on invalide le loader parent
 *   pour récupérer le nouveau brouillon et le marquer actif.
 * - Publication : appelle `approveResponseFn`. On sauve d'abord les
 *   éventuelles édits en attente, sinon l'approve travaille sur du
 *   contenu périmé.
 */
export function ResponseRightPanel({
	review,
	drafts,
	defaultTone,
	onPublished,
	onOpenHistory,
}: Props) {
	const router = useRouter();

	const totalVersions = drafts.length;
	const [activeIdx, setActiveIdx] = useState<number>(
		Math.max(0, drafts.length - 1),
	);
	// Quand un nouveau brouillon arrive (régénération réussie), bascule
	// dessus automatiquement. `Math.max` garde la valid sur les autres
	// changements (ex. suppression — pas encore implémentée).
	useEffect(() => {
		setActiveIdx(Math.max(0, drafts.length - 1));
	}, [drafts.length]);

	const activeDraft = drafts[activeIdx] ?? null;
	const [tone, setTone] = useState<Tone>(activeDraft?.tone ?? defaultTone);
	const [content, setContent] = useState<string>(activeDraft?.content ?? "");
	// Quand l'active draft change (user cycle versions, ou re-gen),
	// on resync le ton + le contenu local sur le brouillon actif.
	useEffect(() => {
		setTone(activeDraft?.tone ?? defaultTone);
		setContent(activeDraft?.content ?? "");
	}, [activeDraft, defaultTone]);

	const [regenerating, setRegenerating] = useState(false);
	const [saving, setSaving] = useState(false);
	const [publishing, setPublishing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const isDirty =
		activeDraft != null && content.trim() !== activeDraft.content.trim();
	const hasDraft = activeDraft != null;
	const isPublishing = publishing;
	const isLocked = hasDraft && activeDraft.status === "published";

	const regenerate = async (nextTone: Tone) => {
		setError(null);
		setRegenerating(true);
		const result = await generateResponseDraftFn({
			data: { reviewId: review.id, tone: nextTone },
		});
		if (result.kind === "ok") {
			await router.invalidate();
			setRegenerating(false);
			return;
		}
		setError(generateResultToMessage(result));
		setRegenerating(false);
	};

	const onToneChange = (next: Tone) => {
		if (next === tone) return;
		setTone(next);
		void regenerate(next);
	};

	const onSave = async (): Promise<boolean> => {
		if (!activeDraft) return false;
		setError(null);
		setSaving(true);
		const result = await updateResponseContentFn({
			data: { id: activeDraft.id, content },
		});
		setSaving(false);
		if (result.kind === "ok") {
			await router.invalidate();
			return true;
		}
		setError(
			result.kind === "not_found"
				? "Ce brouillon n'existe plus."
				: result.kind === "unauthenticated"
					? "Ta session a expiré."
					: "Impossible d'enregistrer. Réessaie.",
		);
		return false;
	};

	const onPublish = async () => {
		if (!activeDraft) return;
		if (isDirty) {
			const saved = await onSave();
			if (!saved) return;
		}
		setError(null);
		setPublishing(true);
		const result = await approveResponseFn({ data: { id: activeDraft.id } });
		setPublishing(false);
		if (result.kind === "ok") {
			onPublished();
			return;
		}
		setError(
			result.kind === "not_found"
				? "Ce brouillon ne peut plus être approuvé."
				: result.kind === "unauthenticated"
					? "Ta session a expiré."
					: "Impossible d'approuver. Réessaie.",
		);
	};

	return (
		<div className="flex min-w-0 flex-col px-8 pt-7 pb-14">
			<div className="mb-[18px] flex items-center justify-between">
				<div>
					<div className="font-mono text-[11px] text-ink-mute uppercase tracking-[0.06em]">
						Votre réponse
					</div>
					<div className="mt-1 font-serif text-[26px] tracking-[-0.01em]">
						Brouillon{" "}
						<span className="text-accent-ink italic">généré par Avizio</span>
					</div>
				</div>
				<Button
					variant="ghost"
					size="sm"
					icon={<History size={14} strokeWidth={1.75} />}
					onClick={onOpenHistory}
				>
					Historique
				</Button>
			</div>

			<div className="mb-3.5">
				<div className="mb-2 text-[11.5px] text-ink-mute">TON</div>
				<div
					className="grid gap-1.5"
					style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
				>
					{TONE_OPTIONS.map((opt) => (
						<ChoiceCard
							key={opt.value}
							label={opt.label}
							sub={opt.subtitle}
							active={tone === opt.value}
							onClick={() => onToneChange(opt.value)}
							disabled={regenerating || isLocked}
						/>
					))}
				</div>
			</div>

			<EditorShell
				hasDraft={hasDraft}
				regenerating={regenerating}
				content={content}
				onContentChange={setContent}
				activeIdx={activeIdx}
				totalVersions={totalVersions}
				onPrevVersion={
					activeIdx > 0 ? () => setActiveIdx(activeIdx - 1) : undefined
				}
				onNextVersion={
					activeIdx < totalVersions - 1
						? () => setActiveIdx(activeIdx + 1)
						: undefined
				}
				modelLabel={activeDraft?.modelId ?? "claude-sonnet-4-5"}
				promptVersionLabel={activeDraft?.promptVersion ?? "reviews-reply-v1"}
				isDirty={isDirty}
				onRegenerate={() => regenerate(tone)}
				readOnly={isLocked}
				onEmptyGenerate={() => regenerate(tone)}
			/>

			{error ? (
				<p className="mt-3 rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[12.5px] text-[oklch(0.4_0.12_25)]">
					{error}
				</p>
			) : null}

			<div className="mt-5 flex items-center gap-2.5">
				<Button
					variant="outline"
					size="md"
					onClick={() => void onSave()}
					disabled={!isDirty || saving || isPublishing || isLocked}
				>
					{saving ? "Enregistrement…" : "Enregistrer le brouillon"}
				</Button>
				<div className="flex-1" />
				<Button variant="ghost" size="md" disabled>
					Ignorer cet avis
				</Button>
				<Button
					variant="accent"
					size="md"
					icon={<Send size={14} strokeWidth={1.75} />}
					onClick={() => void onPublish()}
					disabled={!hasDraft || isPublishing || saving || isLocked}
				>
					{isPublishing
						? "Envoi…"
						: `Approuver et publier sur ${PLATFORM_LABELS[review.platform]}`}
				</Button>
			</div>
		</div>
	);
}

type EditorShellProps = {
	readonly hasDraft: boolean;
	readonly regenerating: boolean;
	readonly content: string;
	readonly onContentChange: (next: string) => void;
	readonly activeIdx: number;
	readonly totalVersions: number;
	readonly onPrevVersion?: (() => void) | undefined;
	readonly onNextVersion?: (() => void) | undefined;
	readonly modelLabel: string;
	readonly promptVersionLabel: string;
	readonly isDirty: boolean;
	readonly onRegenerate: () => void;
	readonly readOnly: boolean;
	readonly onEmptyGenerate: () => void;
};

function EditorShell(props: EditorShellProps) {
	const {
		hasDraft,
		regenerating,
		content,
		onContentChange,
		activeIdx,
		totalVersions,
		onPrevVersion,
		onNextVersion,
		modelLabel,
		promptVersionLabel,
		isDirty,
		onRegenerate,
		readOnly,
		onEmptyGenerate,
	} = props;

	return (
		<div className="relative min-h-[360px] flex-1">
			<div className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-line bg-paper">
				{regenerating ? <RegenOverlay /> : null}

				<div className="flex items-center gap-2 border-line-soft border-b bg-bg-deep px-4 py-2.5 text-[11.5px] text-ink-mute">
					{hasDraft ? (
						<>
							<Badge tone="accent">
								<Sparkles size={11} strokeWidth={1.75} />
								IA · version {activeIdx + 1}/{totalVersions}
							</Badge>
							{onPrevVersion || onNextVersion ? (
								<div className="flex gap-1">
									<button
										type="button"
										onClick={onPrevVersion}
										disabled={!onPrevVersion}
										className="rounded border border-line bg-paper px-1.5 py-0.5 text-[10.5px] disabled:opacity-30"
									>
										←
									</button>
									<button
										type="button"
										onClick={onNextVersion}
										disabled={!onNextVersion}
										className="rounded border border-line bg-paper px-1.5 py-0.5 text-[10.5px] disabled:opacity-30"
									>
										→
									</button>
								</div>
							) : null}
							<span>
								Modèle {modelLabel} · {promptVersionLabel}
							</span>
						</>
					) : (
						<span>Aucun brouillon pour l'instant</span>
					)}
					<span className="ml-auto">
						{content.length} / {MAX_CONTENT_LENGTH}
					</span>
				</div>

				{hasDraft ? (
					<textarea
						value={content}
						onChange={(e) => onContentChange(e.target.value)}
						readOnly={readOnly}
						maxLength={MAX_CONTENT_LENGTH}
						className="flex-1 resize-none border-none bg-transparent px-[26px] py-[22px] font-serif text-[17px] text-ink outline-none leading-[1.6]"
					/>
				) : (
					<EmptyEditor onGenerate={onEmptyGenerate} />
				)}

				<div className="flex items-center gap-2 border-line-soft border-t bg-bg-deep px-4 py-3">
					<Button
						variant="subtle"
						size="sm"
						icon={<Wand2 size={14} strokeWidth={1.75} />}
						onClick={onRegenerate}
						disabled={regenerating || readOnly}
					>
						{hasDraft ? "Régénérer" : "Générer le premier brouillon"}
					</Button>
					{isDirty ? (
						<span className="ml-auto text-[11px] text-ink-mute italic">
							Modifications non enregistrées
						</span>
					) : null}
				</div>
			</div>
		</div>
	);
}

function RegenOverlay(): ReactNode {
	return (
		<div className="absolute inset-0 z-[2] flex flex-col items-center justify-center gap-2.5 bg-[oklch(1_0_0_/_0.85)]">
			<div className="shimmer h-12 w-12 rounded-full" />
			<div className="font-serif text-[13px] text-ink-soft italic">
				Avizio rédige votre réponse…
			</div>
		</div>
	);
}

function EmptyEditor({ onGenerate }: { onGenerate: () => void }) {
	return (
		<div className="flex flex-1 items-center justify-center px-[26px] py-12 text-center">
			<div>
				<div className="font-serif text-[20px]">Pas encore de brouillon.</div>
				<p className="mt-1 text-[13px] text-ink-soft">
					Lancez une génération IA avec le ton par défaut de l'établissement.
				</p>
				<div className="mt-4 flex justify-center">
					<Button
						variant="accent"
						size="md"
						icon={<Wand2 size={14} strokeWidth={1.75} />}
						onClick={onGenerate}
					>
						Générer un brouillon
					</Button>
				</div>
			</div>
		</div>
	);
}
