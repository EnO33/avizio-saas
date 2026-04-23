import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { EstablishmentSummary } from "#/server/db/queries/establishments";
import {
	type GbpLocationChoice,
	type ListGbpLocationsResult,
	linkGbpLocationFn,
	listGbpLocationsForPicker,
	unlinkGbpLocationFn,
} from "#/server/fns/establishments";

type Props = {
	readonly establishment: EstablishmentSummary;
};

/**
 * Section rendered on the establishment edit page that mirrors the current
 * Google Business Profile link status and exposes the picker when unlinked.
 * Kept as a self-contained client component (useState / useEffect) so the
 * server-side route loader doesn't have to fan out to Google before the
 * user explicitly asks.
 */
export function GbpLinkPanel({ establishment }: Props) {
	if (establishment.googleLocationName && establishment.googleLocationTitle) {
		return (
			<LinkedState
				establishmentId={establishment.id}
				locationTitle={establishment.googleLocationTitle}
			/>
		);
	}
	return <UnlinkedState establishmentId={establishment.id} />;
}

function LinkedState({
	establishmentId,
	locationTitle,
}: {
	establishmentId: string;
	locationTitle: string;
}) {
	const router = useRouter();
	const [isPending, setIsPending] = useState(false);

	const onUnlink = async () => {
		const confirmed = window.confirm(
			`Délier "${locationTitle}" ? Les avis déjà récupérés restent en base, mais la synchronisation s'arrête.`,
		);
		if (!confirmed) return;

		setIsPending(true);
		const result = await unlinkGbpLocationFn({ data: { id: establishmentId } });

		if (result.kind === "ok") {
			await router.invalidate();
			setIsPending(false);
			return;
		}

		setIsPending(false);
		window.alert(
			result.kind === "not_found"
				? "Cet établissement n'existe plus."
				: result.kind === "unauthenticated"
					? "Ta session a expiré."
					: "Impossible de délier pour le moment.",
		);
	};

	return (
		<section className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-6">
			<div>
				<h2 className="font-semibold text-emerald-900">
					Fiche Google Business Profile
				</h2>
				<p className="mt-1 text-emerald-800 text-sm">
					Lié à <strong>{locationTitle}</strong>. Les avis seront synchronisés
					automatiquement au prochain cycle.
				</p>
			</div>
			<button
				type="button"
				onClick={onUnlink}
				disabled={isPending}
				className="rounded-md border border-emerald-300 bg-white px-4 py-2 font-medium text-emerald-800 text-sm transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isPending ? "Déliaison…" : "Délier"}
			</button>
		</section>
	);
}

function UnlinkedState({ establishmentId }: { establishmentId: string }) {
	const [showPicker, setShowPicker] = useState(false);

	return (
		<section className="space-y-4 rounded-lg border border-neutral-200 p-6">
			<div>
				<h2 className="font-semibold text-lg">Fiche Google Business Profile</h2>
				<p className="mt-1 text-neutral-500 text-sm">
					Cet établissement n'est pas lié à une fiche Google. Lie-le pour
					commencer à récupérer les avis automatiquement.
				</p>
			</div>
			{showPicker ? (
				<Picker
					establishmentId={establishmentId}
					onCancel={() => setShowPicker(false)}
				/>
			) : (
				<button
					type="button"
					onClick={() => setShowPicker(true)}
					className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-neutral-800"
				>
					Lier à une fiche Google
				</button>
			)}
		</section>
	);
}

function Picker({
	establishmentId,
	onCancel,
}: {
	establishmentId: string;
	onCancel: () => void;
}) {
	const router = useRouter();
	const [state, setState] = useState<ListGbpLocationsResult | "loading">(
		"loading",
	);
	const [linkingName, setLinkingName] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		const run = async () => {
			const result = await listGbpLocationsForPicker();
			if (!cancelled) setState(result);
		};
		run();
		return () => {
			cancelled = true;
		};
	}, []);

	const onPick = async (choice: GbpLocationChoice) => {
		setLinkingName(choice.locationName);
		const result = await linkGbpLocationFn({
			data: {
				id: establishmentId,
				locationName: choice.locationName,
				locationTitle: choice.locationTitle,
			},
		});
		setLinkingName(null);

		if (result.kind === "ok") {
			await router.invalidate();
			return;
		}
		window.alert(
			result.kind === "not_found"
				? "Cet établissement n'existe plus."
				: result.kind === "unauthenticated"
					? "Ta session a expiré."
					: "Impossible de lier pour le moment.",
		);
	};

	return (
		<div className="space-y-3">
			<PickerBody state={state} linkingName={linkingName} onPick={onPick} />
			<button
				type="button"
				onClick={onCancel}
				className="text-neutral-500 text-sm hover:text-neutral-900 hover:underline"
			>
				Annuler
			</button>
		</div>
	);
}

function PickerBody({
	state,
	linkingName,
	onPick,
}: {
	state: ListGbpLocationsResult | "loading";
	linkingName: string | null;
	onPick: (choice: GbpLocationChoice) => void;
}) {
	if (state === "loading") {
		return <StatusMessage tone="neutral">Chargement des fiches…</StatusMessage>;
	}

	if (state.kind === "ok") {
		if (state.locations.length === 0) {
			return (
				<StatusMessage tone="amber">
					Aucune fiche trouvée sur ton compte Google. Vérifie que tu as bien les
					droits Owner ou Manager sur au moins une fiche Business Profile.
				</StatusMessage>
			);
		}
		return (
			<ul className="divide-y divide-neutral-200 overflow-hidden rounded-md border border-neutral-200 bg-white">
				{state.locations.map((loc) => (
					<LocationRow
						key={loc.locationName}
						loc={loc}
						isLinking={linkingName === loc.locationName}
						disabled={linkingName !== null}
						onPick={onPick}
					/>
				))}
			</ul>
		);
	}

	if (state.kind === "no_connection") {
		return (
			<StatusMessage tone="amber">
				Aucune connexion Google active.{" "}
				<Link
					to="/dashboard"
					className="font-medium underline hover:no-underline"
				>
					Connecte Google Business Profile depuis le dashboard
				</Link>{" "}
				d'abord.
			</StatusMessage>
		);
	}

	if (state.kind === "insufficient_scope") {
		return (
			<StatusMessage tone="amber">
				Ta connexion Google n'a pas le scope <code>business.manage</code> —
				nécessaire pour lister tes fiches. Si tu viens d'obtenir l'accès à l'API
				Business Profile, reconnecte Google depuis le dashboard pour récupérer
				le nouveau scope.
			</StatusMessage>
		);
	}

	if (state.kind === "connection_revoked") {
		return (
			<StatusMessage tone="red">
				Ta connexion Google a été révoquée.{" "}
				<Link
					to="/dashboard"
					className="font-medium underline hover:no-underline"
				>
					Reconnecte-la depuis le dashboard
				</Link>
				.
			</StatusMessage>
		);
	}

	if (state.kind === "unauthenticated") {
		return (
			<StatusMessage tone="red">
				Ta session a expiré. Reconnecte-toi.
			</StatusMessage>
		);
	}

	return (
		<StatusMessage tone="red">
			Erreur en récupérant les fiches Google. Réessaie dans un instant.
		</StatusMessage>
	);
}

function LocationRow({
	loc,
	isLinking,
	disabled,
	onPick,
}: {
	loc: GbpLocationChoice;
	isLinking: boolean;
	disabled: boolean;
	onPick: (choice: GbpLocationChoice) => void;
}) {
	return (
		<li className="flex items-center justify-between gap-4 p-4">
			<div className="min-w-0">
				<div className="font-medium text-neutral-900 text-sm">
					{loc.locationTitle}
				</div>
				<div className="mt-1 truncate text-neutral-500 text-xs">
					{loc.address ?? "Adresse non renseignée"}
					{loc.accountLabel ? ` · ${loc.accountLabel}` : null}
				</div>
			</div>
			<button
				type="button"
				onClick={() => onPick(loc)}
				disabled={disabled}
				className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white text-xs transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{isLinking ? "Liaison…" : "Lier"}
			</button>
		</li>
	);
}

const TONE_STYLES = {
	neutral: "border-neutral-200 bg-white text-neutral-600",
	amber: "border-amber-200 bg-amber-50 text-amber-900",
	red: "border-red-200 bg-red-50 text-red-900",
} as const;

function StatusMessage({
	tone,
	children,
}: {
	tone: keyof typeof TONE_STYLES;
	children: React.ReactNode;
}) {
	return (
		<div className={`rounded-md border px-4 py-3 text-sm ${TONE_STYLES[tone]}`}>
			{children}
		</div>
	);
}
