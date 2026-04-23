import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	EstablishmentForm,
	type EstablishmentFormValues,
} from "#/components/establishments/establishment-form";
import { createEstablishmentFn } from "#/server/fns/establishments";

export const Route = createFileRoute("/_authed/establishments/new")({
	component: NewEstablishmentPage,
});

function NewEstablishmentPage() {
	const navigate = useNavigate();

	const onSubmit = async (
		values: EstablishmentFormValues,
	): Promise<string | undefined> => {
		const result = await createEstablishmentFn({
			data: {
				name: values.name,
				city: values.city,
				postalCode: values.postalCode ?? null,
				businessType: values.businessType,
				languageCode: values.languageCode,
			},
		});

		if (result.kind === "ok") {
			await navigate({ to: "/establishments" });
			return undefined;
		}
		if (result.kind === "unauthenticated") {
			return "Ta session a expiré. Reconnecte-toi pour créer un établissement.";
		}
		return "Impossible de créer l'établissement. Réessaie dans un instant.";
	};

	return (
		<main className="mx-auto max-w-2xl space-y-6 p-8">
			<div>
				<Link
					to="/establishments"
					className="text-neutral-500 text-sm hover:text-neutral-900"
				>
					← Établissements
				</Link>
				<h1 className="mt-2 font-bold text-3xl tracking-tight">
					Nouvel établissement
				</h1>
				<p className="mt-1 text-neutral-500 text-sm">
					Les avis de cet établissement seront regroupés ici une fois la
					synchronisation effectuée.
				</p>
			</div>

			<div className="rounded-lg border border-neutral-200 bg-white p-6">
				<EstablishmentForm
					submitLabel="Créer l'établissement"
					onSubmit={onSubmit}
				/>
			</div>
		</main>
	);
}
