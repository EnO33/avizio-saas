import { describe, expect, it } from "vitest";
import { unknownToMessage } from "./errors";

describe("unknownToMessage", () => {
	it("returns Error.message when given an Error", () => {
		expect(unknownToMessage(new Error("boom"))).toBe("boom");
	});

	it("returns the string itself when given a string", () => {
		expect(unknownToMessage("raw error")).toBe("raw error");
	});

	it("stringifies null and undefined", () => {
		expect(unknownToMessage(null)).toBe("null");
		expect(unknownToMessage(undefined)).toBe("undefined");
	});

	it("stringifies primitives", () => {
		expect(unknownToMessage(42)).toBe("42");
		expect(unknownToMessage(true)).toBe("true");
	});

	it("falls back to Object.toString for plain objects", () => {
		expect(unknownToMessage({ a: 1 })).toBe("[object Object]");
	});

	it("uses the Error message even for subclasses", () => {
		class DbError extends Error {}
		expect(unknownToMessage(new DbError("constraint failed"))).toBe(
			"constraint failed",
		);
	});
});
