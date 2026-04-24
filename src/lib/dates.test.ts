import { describe, expect, it } from "vitest";
import {
	formatLongDateFr,
	formatMonoDateFr,
	formatNumberFr,
	timeAgoFr,
} from "./dates";

describe("formatLongDateFr", () => {
	it("renders as weekday + day + month in French, no year", () => {
		// 24 avril 2026 est un vendredi
		const d = new Date("2026-04-24T10:00:00Z");
		expect(formatLongDateFr(d)).toBe("vendredi 24 avril");
	});
});

describe("formatMonoDateFr", () => {
	it("uppercases the long format including accents", () => {
		const d = new Date("2026-02-05T10:00:00Z"); // jeudi
		expect(formatMonoDateFr(d)).toBe("JEUDI 5 FÉVRIER");
	});
});

describe("timeAgoFr", () => {
	const now = new Date("2026-04-24T12:00:00Z");

	it("returns 'à l'instant' for < 1 minute", () => {
		const d = new Date("2026-04-24T11:59:30Z");
		expect(timeAgoFr(d, now)).toBe("à l'instant");
	});

	it("returns minutes under one hour", () => {
		const d = new Date("2026-04-24T11:35:00Z");
		expect(timeAgoFr(d, now)).toBe("il y a 25 min");
	});

	it("returns hours under one day", () => {
		const d = new Date("2026-04-24T06:00:00Z");
		expect(timeAgoFr(d, now)).toBe("il y a 6 h");
	});

	it("returns days under one week", () => {
		const d = new Date("2026-04-21T12:00:00Z");
		expect(timeAgoFr(d, now)).toBe("il y a 3 j");
	});

	it("falls back to absolute short date beyond one week", () => {
		const d = new Date("2026-03-15T12:00:00Z");
		expect(timeAgoFr(d, now)).toBe("15 mars");
	});

	it("accepts ISO strings", () => {
		expect(timeAgoFr("2026-04-24T11:35:00Z", now)).toBe("il y a 25 min");
	});
});

describe("formatNumberFr", () => {
	it("uses comma as decimal separator", () => {
		expect(formatNumberFr(4.6)).toBe("4,6");
	});

	it("respects fractionDigits (default 1)", () => {
		expect(formatNumberFr(4.65, 2)).toBe("4,65");
	});

	it("pads missing decimals", () => {
		expect(formatNumberFr(5, 1)).toBe("5,0");
	});
});
