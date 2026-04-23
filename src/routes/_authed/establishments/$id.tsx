import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DeleteEstablishmentButton } from "#/components/establishments/delete-establishment-button";
import {
	EstablishmentForm,
	type EstablishmentFormValues,
} from "#/components/establishments/establishment-form";
import { GbpLinkPanel } from "#/components/establishments/gbp-link-panel";
import {
	getEstablishment,
	updateEstablishmentFn,
} from "#/server/fns/establishments";

export const Route = createFileRoute("/_authed/establishments/$id")({
	loader: async ({ params }) => ({
		establishment: await getEstablishment({ data: { id: params.id } }),
	}),
	component: EditEstablishmentPage,
});

function EditEstablishmentPage() {
	const { establishment } = Route.useLoaderData();

	if (!establishment) {
		return (
			<main className="mx-auto max-w-2xl space-y-4 p-8">
				<Link
					to="/establishments"
					className="text-neutral-500 text-sm hover:text-neutral-900"
				>
					← Établissements
				</Link>
				<div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
					<h1 className="font-semibold text-amber-900 text-lg">
						Établissement introuvable
					</h1>
					<p className="mt-1 text-amber-800 text-sm">
						Il a peut-être été supprimé, ou ne fait pas partie de ton
						organisation active.
					</p>
				</div>
			</main>
		);
	}

	return <EditEstablishmentForm establishment={establishment} />;
}

function EditEstablishmentForm({
	establishment,
}: {
	establishment: NonNullable<
		ReturnType<typeof Route.useLoaderData>["establishment"]
	>;
}) {
	const navigate = useNavigate();

	const onSubmit = async (
		values: EstablishmentFormValues,
	): Promise<string | undefined> => {
		const result = await updateEstablishmentFn({
			data: {
				id: establishment.id,
				name: values.name,
				city: values.city,
				postalCode: values.postalCode.length > 0 ? values.postalCode : null,
				businessType: values.businessType,
				languageCode: values.languageCode,
			},
		});

		if (result.kind === "ok") {
			await navigate({ to: "/establishments" });
			return undefined;
		}
		if (result.kind === "unauthenticated") {
			return "Ta session a expiré. Reconnecte-toi pour enregistrer.";
		}
		if (result.kind === "not_found") {
			return "Cet établissement n'existe plus — retourne à la liste.";
		}
		return "Impossible d'enregistrer. Réessaie dans un instant.";
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
					{establishment.name}
				</h1>
				<p className="mt-1 text-neutral-500 text-sm">
					Modifie les informations principales de cet établissement.
				</p>
			</div>

			<div className="rounded-lg border border-neutral-200 bg-white p-6">
				<EstablishmentForm
					submitLabel="Enregistrer"
					onSubmit={onSubmit}
					initialValues={{
						name: establishment.name,
						city: establishment.city,
						postalCode: establishment.postalCode ?? "",
						businessType: establishment.businessType,
						languageCode: establishment.languageCode,
					}}
				/>
			</div>

			<GbpLinkPanel establishment={establishment} />

			<section className="space-y-3 rounded-lg border border-red-200 bg-white p-6">
				<div>
					<h2 className="font-semibold text-red-900">Zone dangereuse</h2>
					<p className="mt-1 text-red-800 text-sm">
						Supprimer cet établissement efface aussi tous ses avis et réponses
						liés. Action irréversible.
					</p>
				</div>
				<DeleteEstablishmentButton
					establishmentId={establishment.id}
					establishmentName={establishment.name}
				/>
			</section>
		</main>
	);
}
