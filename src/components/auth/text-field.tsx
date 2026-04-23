import type { InputHTMLAttributes, Ref } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
	ref?: Ref<HTMLInputElement>;
	label: string;
	error?: string | undefined;
};

export function TextField({ ref, label, error, id, name, ...rest }: Props) {
	const fieldId = id ?? name;
	return (
		<div>
			<label
				htmlFor={fieldId}
				className="block font-medium text-neutral-900 text-sm"
			>
				{label}
			</label>
			<input
				ref={ref}
				id={fieldId}
				name={name}
				aria-invalid={error ? "true" : undefined}
				className="mt-1 block w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-neutral-900 text-sm placeholder:text-neutral-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 aria-invalid:border-red-500 aria-invalid:focus:border-red-500 aria-invalid:focus:ring-red-500"
				{...rest}
			/>
			{error ? (
				<p className="mt-1 text-red-600 text-sm" role="alert">
					{error}
				</p>
			) : null}
		</div>
	);
}
