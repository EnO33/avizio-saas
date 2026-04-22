type Step = {
	number: string;
	title: string;
	body: string;
};

const steps: readonly Step[] = [
	{
		number: "01",
		title: "Connectez vos comptes",
		body: "Google Business Profile, TripAdvisor, Trustpilot — en 2 minutes, sans compétence technique.",
	},
	{
		number: "02",
		title: "L'IA propose des réponses",
		body: "Chaque nouvel avis déclenche une réponse personnalisée selon votre ton et votre contexte.",
	},
	{
		number: "03",
		title: "Vous validez et publiez",
		body: "Relisez, éditez si besoin, publiez. Notifications email quand une réponse vous attend.",
	},
];

export function HowItWorks() {
	return (
		<section
			id="how-it-works"
			className="border-neutral-200 border-t bg-neutral-50"
		>
			<div className="mx-auto max-w-6xl px-6 py-20">
				<div className="mx-auto max-w-2xl text-center">
					<h2 className="font-bold text-3xl text-neutral-900 tracking-tight md:text-4xl">
						Trois étapes, zéro prise de tête
					</h2>
					<p className="mt-4 text-lg text-neutral-600">
						De l'inscription à votre première réponse publiée — moins de 10
						minutes.
					</p>
				</div>
				<ol className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
					{steps.map((s) => (
						<li
							key={s.number}
							className="rounded-lg border border-neutral-200 bg-white p-6"
						>
							<span className="font-mono text-amber-700 text-sm">
								{s.number}
							</span>
							<h3 className="mt-3 font-semibold text-lg text-neutral-900">
								{s.title}
							</h3>
							<p className="mt-2 text-neutral-600 text-sm">{s.body}</p>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
