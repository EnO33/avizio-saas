import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { disconnectConnection } from "#/server/fns/connections";

type Props = {
	connectionId: string;
	platformLabel: string;
};

export function DisconnectButton({ connectionId, platformLabel }: Props) {
	const router = useRouter();
	const [isPending, setIsPending] = useState(false);

	const onClick = async () => {
		const confirmed = window.confirm(
			`Déconnecter ${platformLabel} ? Les avis déjà récupérés restent en base, mais la synchronisation s'arrête immédiatement.`,
		);
		if (!confirmed) return;

		setIsPending(true);
		const result = await disconnectConnection({ data: { id: connectionId } });

		if (result.kind === "ok") {
			// Re-run the dashboard loader so the row disappears and the
			// Connect button reappears for this platform.
			await router.invalidate();
			setIsPending(false);
			return;
		}

		setIsPending(false);
		const message =
			result.kind === "not_found"
				? "Cette connexion n'existe plus ou a déjà été déconnectée."
				: result.kind === "unauthenticated"
					? "Ta session a expiré. Reconnecte-toi."
					: "Impossible de déconnecter pour le moment. Réessaie dans un instant.";
		window.alert(message);
	};

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={isPending}
			className="shrink-0 rounded-md border border-neutral-200 bg-white px-3 py-1.5 font-medium text-neutral-700 text-xs transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{isPending ? "Déconnexion…" : "Déconnecter"}
		</button>
	);
}
