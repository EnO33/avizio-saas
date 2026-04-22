import {
	Show,
	SignInButton,
	SignUpButton,
	UserButton,
} from "@clerk/tanstack-react-start";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="mx-auto max-w-2xl p-8">
			<h1 className="text-4xl font-bold tracking-tight">Avizio</h1>
			<p className="mt-4 text-lg text-neutral-600">
				Gérez et répondez aux avis clients de votre commerce avec l'IA.
			</p>
			<div className="mt-8 flex items-center gap-3">
				<Show when="signed-out">
					<SignInButton>
						<button
							type="button"
							className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
						>
							Se connecter
						</button>
					</SignInButton>
					<SignUpButton>
						<button
							type="button"
							className="rounded-md border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
						>
							Créer un compte
						</button>
					</SignUpButton>
				</Show>
				<Show when="signed-in">
					<Link
						to="/dashboard"
						className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
					>
						Accéder au dashboard
					</Link>
					<UserButton />
				</Show>
			</div>
		</main>
	);
}
