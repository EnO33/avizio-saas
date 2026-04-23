import { Link } from "@tanstack/react-router";

export function EmptyEstablishmentsState() {
	return (
		<div className="flex flex-col items-center gap-4 rounded-lg border border-neutral-200 border-dashed bg-white px-8 py-16 text-center">
			<StorefrontIcon />
			<div className="max-w-md space-y-2">
				<h2 className="font-semibold text-lg text-neutral-900">
					Aucun établissement pour l'instant
				</h2>
				<p className="text-neutral-600 text-sm">
					Crée ton premier établissement pour commencer à collecter et répondre
					aux avis de tes clients.
				</p>
			</div>
			<Link
				to="/establishments/new"
				className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-neutral-800"
			>
				Créer un établissement
			</Link>
		</div>
	);
}

function StorefrontIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			className="size-12 text-neutral-300"
			aria-hidden="true"
			role="presentation"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
		>
			<title>Établissement</title>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z"
			/>
		</svg>
	);
}
