import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";

type Props = {
	readonly organizationName: string;
	readonly busy: boolean;
	readonly error: string | null;
	readonly onCancel: () => void;
	readonly onConfirm: () => Promise<void> | void;
};

/**
 * Modale de confirmation pour la suppression d'une organisation. Exige
 * que l'user retape le nom exact avant d'activer le bouton — filet de
 * sécurité contre les clics rapides. Même squelette que la modale de
 * création dans `org-switcher.tsx` : portail vers `document.body`
 * (sinon le backdrop reste coincé dans la cellule de grid), Escape ferme.
 */
export function DeleteOrganizationDialog({
	organizationName,
	busy,
	error,
	onCancel,
	onConfirm,
}: Props) {
	const inputId = useId();
	const [typed, setTyped] = useState("");

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !busy) onCancel();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onCancel, busy]);

	const matches = typed.trim() === organizationName.trim();
	const canConfirm = matches && !busy;

	if (typeof document === "undefined") return null;
	return createPortal(
		<div className="fixed inset-0 z-[60]">
			<button
				type="button"
				onClick={busy ? undefined : onCancel}
				aria-label="Fermer"
				disabled={busy}
				className="absolute inset-0 cursor-default border-none bg-[oklch(0.2_0.01_60_/_0.35)]"
			/>
			<div
				role="dialog"
				aria-label="Confirmer la suppression de l'organisation"
				aria-modal="true"
				className="animate-fade-up -translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 w-[min(92vw,460px)] rounded-[16px] border border-line-soft bg-paper p-6 shadow-[var(--shadow-lg)]"
			>
				<div className="mb-1 font-mono text-[11px] text-[oklch(0.4_0.12_25)] uppercase tracking-[0.08em]">
					Zone dangereuse
				</div>
				<div className="mb-4 font-serif font-normal text-[24px] text-ink tracking-[-0.01em]">
					Supprimer « {organizationName} » ?
				</div>
				<p className="mb-5 text-[13px] text-ink-soft leading-[1.55]">
					Tous les établissements, avis et réponses liés seront définitivement
					effacés. Cette action ne peut pas être annulée.
				</p>

				<label
					htmlFor={inputId}
					className="mb-1.5 block text-[12.5px] text-ink-soft"
				>
					Tape « {organizationName} » pour confirmer.
				</label>
				<Input
					id={inputId}
					value={typed}
					onChange={(e) => setTyped(e.target.value)}
					disabled={busy}
					autoFocus
				/>

				{error ? (
					<p className="mt-3 rounded-md bg-[oklch(0.95_0.03_25)] px-3 py-2 text-[12.5px] text-[oklch(0.4_0.12_25)]">
						{error}
					</p>
				) : null}

				<div className="mt-6 flex justify-end gap-2">
					<Button
						type="button"
						variant="ghost"
						size="md"
						onClick={onCancel}
						disabled={busy}
					>
						Annuler
					</Button>
					<Button
						type="button"
						variant="accent"
						size="md"
						onClick={() => void onConfirm()}
						disabled={!canConfirm}
						className="bg-[oklch(0.55_0.18_25)] border-[oklch(0.55_0.18_25)]"
					>
						{busy ? "Suppression…" : "Supprimer définitivement"}
					</Button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
