import { describe, it, expect } from "vitest";
import {
  DEFAULT_TIMEZONE,
  MAX_EMAIL,
  MAX_GYM_NAME,
  MAX_NAME,
  MAX_PASSWORD,
  MAX_PHONE,
  MAX_SLUG,
  MIN_PASSWORD,
  MIN_SLUG,
  normalizePhone,
  normalizeSlug,
  validateOwnerRegistration,
} from "./owner-registration";

const valid = {
  firstName: "Marcus",
  lastName: "Vega",
  email: "Marcus@IronLion.com",
  password: "correct horse",
  gymName: "Iron Lion Academy",
  gymSlug: "iron-lion",
};

function err(patch: Record<string, unknown>) {
  const res = validateOwnerRegistration({ ...valid, ...patch });
  expect(res.ok, JSON.stringify(patch)).toBe(false);
  return res.ok ? null : res.error;
}

describe("normalizeSlug", () => {
  it("lowercases, strips unsafe characters, and collapses hyphens", () => {
    expect(normalizeSlug("  Iron__Lion!! ")).toBe("ironlion");
    expect(normalizeSlug("Iron--Lion")).toBe("iron-lion");
    expect(normalizeSlug("-iron-lion-")).toBe("iron-lion");
    expect(normalizeSlug("IRON LION")).toBe("ironlion");
    expect(normalizeSlug("a---b---c")).toBe("a-b-c");
  });
});

describe("normalizePhone", () => {
  it("keeps digits and a single leading plus, nothing else", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
    expect(normalizePhone("+1 555 123 4567")).toBe("+15551234567");
    expect(normalizePhone("  ")).toBe("");
    expect(normalizePhone("abc")).toBe("");
  });
});

describe("validateOwnerRegistration — accepted", () => {
  it("trims, lowercases the email, and defaults the timezone", () => {
    const res = validateOwnerRegistration({ ...valid, firstName: "  Marcus  " });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.firstName).toBe("Marcus");
      expect(res.value.email).toBe("marcus@ironlion.com");
      expect(res.value.timezone).toBe(DEFAULT_TIMEZONE);
      expect(res.value.phone).toBeNull();
      expect(res.value.gymSlug).toBe("iron-lion");
    }
  });

  it("accepts each supported timezone and normalizes phone/slug", () => {
    const res = validateOwnerRegistration({
      ...valid,
      timezone: "America/Denver",
      phone: "(555) 123-4567",
      gymSlug: "  Iron--Lion-- ",
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value.timezone).toBe("America/Denver");
      expect(res.value.phone).toBe("5551234567");
      expect(res.value.gymSlug).toBe("iron-lion");
    }
  });

  it("accepts boundary lengths", () => {
    const res = validateOwnerRegistration({
      ...valid,
      firstName: "a".repeat(MAX_NAME),
      lastName: "b".repeat(MAX_NAME),
      password: "p".repeat(MAX_PASSWORD),
      gymName: "g".repeat(MAX_GYM_NAME),
      gymSlug: "s".repeat(MAX_SLUG),
      phone: "1".repeat(MAX_PHONE),
    });
    expect(res.ok).toBe(true);
  });

  it("accepts the minimum password and slug", () => {
    expect(validateOwnerRegistration({ ...valid, password: "p".repeat(MIN_PASSWORD) }).ok).toBe(true);
    expect(validateOwnerRegistration({ ...valid, gymSlug: "a".repeat(MIN_SLUG) }).ok).toBe(true);
  });
});

describe("validateOwnerRegistration — rejected", () => {
  it("rejects a non-object body", () => {
    for (const body of [null, undefined, "string", 42, []]) {
      const res = validateOwnerRegistration(body as unknown);
      expect(res.ok, String(body)).toBe(false);
    }
  });

  it("requires the core fields", () => {
    expect(err({ firstName: "" })?.code).toBe("REQUIRED");
    expect(err({ firstName: "   " })?.field).toBe("firstName");
    expect(err({ lastName: "" })?.field).toBe("lastName");
    expect(err({ email: "" })?.field).toBe("email");
    expect(err({ password: "" })?.field).toBe("password");
    expect(err({ gymName: " " })?.field).toBe("gymName");
    expect(err({ gymSlug: "" })?.field).toBe("gymSlug");
  });

  it("rejects non-string input for every field", () => {
    for (const field of ["firstName", "lastName", "email", "gymName", "gymSlug", "password"]) {
      const e = err({ [field]: 12345 });
      expect(e?.field, field).toBe(field);
    }
    expect(err({ phone: { $ne: null } })?.field).toBe("phone");
  });

  it("rejects malformed emails", () => {
    for (const email of ["nope", "no@domain", "a b@c.com", "@nodomain.com", "user@.com", "user@com"]) {
      expect(err({ email })?.code, email).toBe("INVALID_EMAIL");
    }
  });

  it("enforces password bounds without weakening the minimum", () => {
    expect(MIN_PASSWORD).toBe(6); // established minimum, unchanged
    expect(err({ password: "12345" })?.code).toBe("TOO_SHORT");
    expect(err({ password: "p".repeat(MAX_PASSWORD + 1) })?.code).toBe("TOO_LONG");
  });

  it("enforces length ceilings", () => {
    expect(err({ firstName: "a".repeat(MAX_NAME + 1) })?.code).toBe("TOO_LONG");
    expect(err({ lastName: "a".repeat(MAX_NAME + 1) })?.code).toBe("TOO_LONG");
    expect(err({ email: `${"a".repeat(MAX_EMAIL)}@x.com` })?.code).toBe("TOO_LONG");
    expect(err({ gymName: "g".repeat(MAX_GYM_NAME + 1) })?.code).toBe("TOO_LONG");
    expect(err({ phone: "1".repeat(MAX_PHONE + 1) })?.code).toBe("TOO_LONG");
  });

  it("rejects slugs that normalize too short or too long", () => {
    expect(err({ gymSlug: "ab" })?.code).toBe("TOO_SHORT");
    expect(err({ gymSlug: "!!" })?.code).toBe("TOO_SHORT"); // strips to nothing
    expect(err({ gymSlug: "--" })?.code).toBe("TOO_SHORT");
    expect(err({ gymSlug: "s".repeat(MAX_SLUG + 1) })?.code).toBe("TOO_LONG");
  });

  it("rejects unsupported timezones", () => {
    for (const tz of ["Mars/Olympus", "america/chicago", "UTC", 5]) {
      expect(err({ timezone: tz })?.code, String(tz)).toBe("UNSUPPORTED_TIMEZONE");
    }
  });

  it("never returns a password or payload inside the error", () => {
    const e = err({ email: "bad" });
    expect(JSON.stringify(e)).not.toContain(valid.password);
  });
});
