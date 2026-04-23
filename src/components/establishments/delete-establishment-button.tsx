import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { deleteEstablishmentFn } from "#/server/fns/establishments";

type Props = {
	readonly establishmentId: string;
	readonly establishmentName: string;
};

export function DeleteEstablishmentButton({
	establishmentId,
	establishmentName,
}: Props) {
	const navigate = useNavigate();
	const [isPending, setIsPending] = useState(false);

	const onClick = async () => {
		const confirmed = window.confirm(
			`Supprimer "${establishmentName}" ? Cette action efface aussi tous les avis et réponses liés. Elle est irréversible.`,
		);
		if (!confirmed) return;

		setIsPending(true);
		const result = await deleteEstablishmentFn({
			data: { id: establishmentId },
		});

		if (result.kind === "ok") {
			await navigate({ to: "/establishments" });
			return;
		}

		setIsPending(false);
		const message =
			result.kind === "not_found"
				? "Cet établissement n'existe plus."
				: result.kind === "unauthenticated"
					? "Ta session a expiré. Reconnecte-toi."
					: "Impossible de supprimer pour le moment. Réessaie dans un instant.";
		window.alert(message);
	};

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={isPending}
			className="rounded-md border border-red-200 bg-white px-4 py-2 font-medium text-red-700 text-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
		>
			{isPending ? "Suppression…" : "Supprimer l'établissement"}
		</button>
	);
}
