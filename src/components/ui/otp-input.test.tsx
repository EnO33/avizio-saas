// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OtpInput } from "./otp-input";

// Auto-cleanup — vitest ne l'active pas globalement comme jest. Sans ça
// les DOM de tests précédents traînent et `getAllByRole("textbox")`
// matche les inputs de tous les tests mountés jusque-là.
afterEach(cleanup);

describe("OtpInput", () => {
	it("auto-advance focus to the next input on digit entry", () => {
		render(<OtpInput />);
		const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
		expect(inputs).toHaveLength(6);

		inputs[0]?.focus();
		fireEvent.input(inputs[0] as HTMLInputElement, { target: { value: "1" } });
		expect(document.activeElement).toBe(inputs[1]);
	});

	it("moves focus backward on backspace in an empty input", () => {
		render(<OtpInput />);
		const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
		fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: "4" } });
		// inputs[1] is now focused and empty
		fireEvent.keyDown(inputs[1] as HTMLInputElement, { key: "Backspace" });
		expect(document.activeElement).toBe(inputs[0]);
	});

	it("calls onComplete when the full code is entered", () => {
		const onComplete = vi.fn();
		render(<OtpInput onComplete={onComplete} />);
		const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
		for (let i = 0; i < 6; i++) {
			fireEvent.change(inputs[i] as HTMLInputElement, {
				target: { value: String(i + 1) },
			});
		}
		expect(onComplete).toHaveBeenCalledWith("123456");
	});

	it("strips non-digits from pasted content and distributes across inputs", () => {
		const onChange = vi.fn();
		render(<OtpInput onChange={onChange} />);
		const group = screen.getByRole("group");
		fireEvent.paste(group, {
			clipboardData: { getData: () => "12-34 56" },
		});
		// "123456" after stripping
		expect(onChange).toHaveBeenCalledWith("123456");
	});

	it("ignores non-digit keystrokes (only digits are accepted)", () => {
		const onChange = vi.fn();
		render(<OtpInput onChange={onChange} />);
		const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
		fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: "a" } });
		// onChange called with the empty string (digit stripped)
		expect(onChange).toHaveBeenLastCalledWith("");
	});
});
