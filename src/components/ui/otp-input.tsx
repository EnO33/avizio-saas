import { useRef, useState } from "react";

type Props = {
	readonly length?: number;
	readonly value?: string;
	readonly onChange?: (value: string) => void;
	/** Appelé quand l'utilisateur a saisi `length` chiffres. */
	readonly onComplete?: (value: string) => void;
	readonly autoFocus?: boolean;
	readonly disabled?: boolean;
	readonly ariaLabel?: string;
};

/**
 * Code OTP (email verification, reset password). Six inputs d'un chiffre
 * avec auto-advance à la saisie + recul au backspace sur case vide, et
 * support du coller (une valeur de 6 chiffres collée se distribue sur
 * toutes les cases). La saisie est limitée aux chiffres pour que la
 * validation côté serveur ne galère pas sur des caractères parasites.
 *
 * Mode contrôlé (`value` fourni) ou non-contrôlé (état interne). Les
 * deux ont `onChange` + `onComplete` pour brancher un `.attempt*()`
 * Clerk dès que le code fait la bonne longueur.
 */
export function OtpInput({
	length = 6,
	value,
	onChange,
	onComplete,
	autoFocus = false,
	disabled = false,
	ariaLabel = "Code à 6 chiffres",
}: Props) {
	const [internal, setInternal] = useState<string>("");
	const current = value ?? internal;
	const refs = useRef<Array<HTMLInputElement | null>>([]);

	/*
	  Toutes les mutations passent par un ref de la valeur courante plutôt
	  que par la closure — sans ça, deux `fireEvent.change` consécutifs
	  dans un test (ou deux `onChange` rapides en prod avant re-render)
	  peuvent lire une valeur périmée. Le ref se met à jour de façon
	  synchrone, la state React suit pour que l'UI re-render.
	*/
	const liveValue = useRef<string>(current);
	liveValue.current = current;

	const applyChange = (mutate: (prev: string) => string) => {
		const next = mutate(liveValue.current).replace(/\D/g, "").slice(0, length);
		liveValue.current = next;
		if (value === undefined) setInternal(next);
		onChange?.(next);
		if (next.length === length) onComplete?.(next);
	};

	const handleChange = (idx: number, v: string) => {
		const digit = v.replace(/\D/g, "").slice(-1);
		applyChange((prev) => {
			const chars = Array.from({ length }, (_, i) => prev[i] ?? "");
			chars[idx] = digit;
			return chars.join("");
		});
		if (digit && idx < length - 1) refs.current[idx + 1]?.focus();
	};

	const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
		if (e.key === "Backspace" && !current[idx] && idx > 0) {
			refs.current[idx - 1]?.focus();
		}
	};

	const handlePaste = (e: React.ClipboardEvent) => {
		const pasted = e.clipboardData.getData("text").replace(/\D/g, "");
		if (pasted.length === 0) return;
		e.preventDefault();
		applyChange(() => pasted);
		const lastIdx = Math.min(pasted.length, length) - 1;
		refs.current[lastIdx]?.focus();
	};

	return (
		<fieldset
			aria-label={ariaLabel}
			className="flex gap-2 border-0 p-0"
			onPaste={handlePaste}
		>
			{Array.from({ length }).map((_, i) => (
				<input
					// biome-ignore lint/suspicious/noArrayIndexKey: fixed-length positional inputs
					key={i}
					ref={(el) => {
						refs.current[i] = el;
					}}
					value={current[i] ?? ""}
					onChange={(e) => handleChange(i, e.target.value)}
					onKeyDown={(e) => handleKeyDown(i, e)}
					disabled={disabled}
					// biome-ignore lint/a11y/noAutofocus: deliberate for code entry UX — user arrives specifically to type this
					autoFocus={autoFocus && i === 0}
					inputMode="numeric"
					maxLength={1}
					aria-label={`Chiffre ${i + 1}`}
					className="h-14 w-[52px] rounded-lg border border-line bg-paper text-center font-serif text-[26px] text-ink outline-none transition-colors focus:border-accent disabled:opacity-50"
				/>
			))}
		</fieldset>
	);
}
