import { describe, expect, it } from "vitest";
import { isEmailVerified } from "@/lib/firebase";

describe("isEmailVerified", () => {
  it("returns true when Supabase confirms the email", () => {
    expect(isEmailVerified({ email_confirmed_at: "2026-11-23T10:00:00.000Z", confirmed_at: null })).toBe(true);
    expect(isEmailVerified({ email_confirmed_at: null, confirmed_at: "2026-11-23T10:00:00.000Z" })).toBe(true);
  });

  it("returns false when the email has not been confirmed", () => {
    expect(isEmailVerified({ email_confirmed_at: null, confirmed_at: null })).toBe(false);
  });
});
