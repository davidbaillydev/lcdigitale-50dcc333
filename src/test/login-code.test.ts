import { describe, expect, it } from "vitest";
import { isValidLoginCode, LOGIN_CODE_MAX_LENGTH } from "@/lib/login-code";

describe("auth login codes", () => {
  it("accepts the complete eight-digit code, including leading zeros", () => {
    expect(LOGIN_CODE_MAX_LENGTH).toBe(8);
    expect(isValidLoginCode("00123456")).toBe(true);
  });
  it("retains support for six-digit codes", () => {
    expect(isValidLoginCode("012345")).toBe(true);
  });
  it("rejects incomplete, oversized or non-numeric codes", () => {
    for (const code of ["", "12345", "1234567", "123456789", "12ab3456"]) {
      expect(isValidLoginCode(code)).toBe(false);
    }
  });
});