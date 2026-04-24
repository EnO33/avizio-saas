import { createFileRoute, Link } from "@tanstack/react-router";
import { EstablishmentSettings } from "#/components/establishments/establishment-settings";
import { getEstablishment } from "#/server/fns/establishments";

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
			<main className="mx-auto max-w-[560px] space-y-4 p-10">
				<Link
					to="/establishments"
					className="text-[12.5px] text-ink-soft hover:text-ink"
				>
					← Établissements
				</Link>
				<div className="rounded-lg border border-[oklch(0.88_0.04_25)] bg-[oklch(0.95_0.03_25)] p-6">
					<h1 className="font-serif text-[22px] text-[oklch(0.4_0.12_25)]">
						Établissement introuvable
					</h1>
					<p className="mt-1 text-[13px] text-[oklch(0.45_0.12_25)]">
						Il a peut-être été supprimé, ou ne fait pas partie de votre
						organisation active.
					</p>
				</div>
			</main>
		);
	}

	return <EstablishmentSettings establishment={establishment} />;
}
