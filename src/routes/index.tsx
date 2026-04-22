import { createFileRoute } from "@tanstack/react-router";
import { Features } from "#/components/landing/features";
import { Hero } from "#/components/landing/hero";
import { HowItWorks } from "#/components/landing/how-it-works";
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
				<HowItWorks />
				<Pricing />
			</main>
			<Footer />
		</>
	);
}
