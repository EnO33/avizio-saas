export function Divider({ label = "ou" }: { label?: string }) {
	return (
		<div className="flex items-center gap-3">
			<div className="h-px flex-1 bg-neutral-200" />
			<span className="text-neutral-500 text-xs uppercase tracking-wide">
				{label}
			</span>
			<div className="h-px flex-1 bg-neutral-200" />
		</div>
	);
}
