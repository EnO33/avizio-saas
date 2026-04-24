import { createFileRoute } from "@tanstack/react-router";
import { Features } from "#/components/landing/features";
import { Hero } from "#/components/landing/hero";
import { Pricing } from "#/components/landing/pricing";
import { Footer } from "#/components/shared/footer";
import { Header } from "#/components/shared/header";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<>
			<Header />
			<main>
				<Hero />
				<Features />
				<Pricing />
			</main>
			<Footer />
		</>
	);
}
