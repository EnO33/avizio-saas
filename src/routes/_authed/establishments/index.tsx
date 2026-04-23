import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyEstablishmentsState } from "#/components/establishments/empty-establishments-state";
import { EstablishmentsList } from "#/components/establishments/establishments-list";
import { listEstablishments } from "#/server/fns/establishments";

export const Route = createFileRoute("/_authed/establishments/")({
	loader: async () => ({ establishments: await listEstablishments() }),
	component: EstablishmentsPage,
});

function EstablishmentsPage() {
	const { establishments } = Route.useLoaderData();

	return (
		<main className="mx-auto max-w-5xl space-y-6 p-8">
			<header className="flex items-start justify-between gap-4">
				<div>
					<Link
						to="/dashboard"
						className="text-neutral-500 text-sm hover:text-neutral-900"
					>
						← Dashboard
					</Link>
					<h1 className="mt-2 font-bold text-3xl tracking-tight">
						Établissements
					</h1>
					<p className="mt-1 text-neutral-500 text-sm">
						{establishments.length === 0
							? "Tes restaurants, hôtels, cafés…"
							: establishments.length === 1
								? "1 établissement"
								: `${establishments.length} établissements`}
					</p>
				</div>
				{establishments.length > 0 ? (
					<Link
						to="/establishments/new"
						className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-neutral-800"
					>
						Nouvel établissement
					</Link>
				) : null}
			</header>

			{establishments.length === 0 ? (
				<EmptyEstablishmentsState />
			) : (
				<EstablishmentsList establishments={establishments} />
			)}
		</main>
	);
}
