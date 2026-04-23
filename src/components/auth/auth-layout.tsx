import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type Props = {
	title: string;
	subtitle?: ReactNode;
	children: ReactNode;
	footer?: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: Props) {
	return (
		<main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-amber-50/60 to-white px-6 py-12">
			<div className="w-full max-w-md">
				<Link
					to="/"
					className="mb-8 inline-block font-bold text-2xl text-neutral-900 tracking-tight"
				>
					Avizio
				</Link>
				<div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
					<h1 className="font-bold text-2xl text-neutral-900 tracking-tight">
						{title}
					</h1>
					{subtitle ? (
						<p className="mt-2 text-neutral-600 text-sm">{subtitle}</p>
					) : null}
					<div className="mt-6">{children}</div>
				</div>
				{footer ? (
					<p className="mt-6 text-center text-neutral-600 text-sm">{footer}</p>
				) : null}
			</div>
		</main>
	);
}
