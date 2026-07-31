/**
 * Server-authoritative validation for academy-owner registration.
 *
 * Pure: no DB, no auth, no environment. The route applies uniqueness checks
 * (email, slug) separately because those need queries.
 */

export const MIN_PASSWORD = 6; // established minimum — unchanged
export const MAX_PASSWORD = 200; // bcrypt truncates at 72 bytes; bound the input
export const MAX_NAME = 80;
export const MAX_EMAIL = 254; // RFC 5321 practical maximum
export const MAX_PHONE = 32;
export const MAX_GYM_NAME = 120;
export const MIN_SLUG = 3;
export const MAX_SLUG = 60;

export const SUPPORTED_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Pacific/Honolulu",
] as const;

export const DEFAULT_TIMEZONE = "America/Chicago";

export interface OwnerRegistrationInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  password: string;
  gymName: string;
  gymSlug: string;
  timezone: string;
}

export type RegistrationError = { field: string; code: string; message: string };

export type RegistrationValidationResult =
  | { ok: true; value: OwnerRegistrationInput }
  | { ok: false; error: RegistrationError };

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function fail(field: string, code: string, message: string): RegistrationValidationResult {
  return { ok: false, error: { field, code, message } };
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

/**
 * Conservative phone normalization: keep digits and a single leading "+".
 * We never reformat or assume a country — this only strips presentation.
 */
export function normalizePhone(raw: string): string {
  const plus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  return digits ? `${plus ? "+" : ""}${digits}` : "";
}

/** Lowercase, safe characters, no leading/trailing/repeated hyphens. */
export function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function validateOwnerRegistration(body: unknown): RegistrationValidationResult {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail("body", "INVALID_BODY", "Request body must be an object.");
  }
  const input = body as Record<string, unknown>;

  const firstName = text(input.firstName);
  if (!firstName) return fail("firstName", "REQUIRED", "Enter your first name.");
  if (firstName.length > MAX_NAME) return fail("firstName", "TOO_LONG", `First name must be ${MAX_NAME} characters or fewer.`);

  const lastName = text(input.lastName);
  if (!lastName) return fail("lastName", "REQUIRED", "Enter your last name.");
  if (lastName.length > MAX_NAME) return fail("lastName", "TOO_LONG", `Last name must be ${MAX_NAME} characters or fewer.`);

  const emailRaw = text(input.email);
  if (!emailRaw) return fail("email", "REQUIRED", "Enter your email address.");
  const email = emailRaw.toLowerCase();
  if (email.length > MAX_EMAIL) return fail("email", "TOO_LONG", "That email address is too long.");
  if (!EMAIL.test(email)) return fail("email", "INVALID_EMAIL", "Enter a valid email address.");

  let phone: string | null = null;
  if (input.phone !== undefined && input.phone !== null && input.phone !== "") {
    const phoneRaw = text(input.phone);
    if (phoneRaw === null) return fail("phone", "INVALID", "Phone must be text.");
    if (phoneRaw.length > MAX_PHONE) return fail("phone", "TOO_LONG", `Phone must be ${MAX_PHONE} characters or fewer.`);
    const normalized = normalizePhone(phoneRaw);
    phone = normalized || null;
  }

  const password = typeof input.password === "string" ? input.password : null;
  if (!password) return fail("password", "REQUIRED", "Choose a password.");
  if (password.length < MIN_PASSWORD) {
    return fail("password", "TOO_SHORT", `Password must be at least ${MIN_PASSWORD} characters.`);
  }
  if (password.length > MAX_PASSWORD) {
    return fail("password", "TOO_LONG", `Password must be ${MAX_PASSWORD} characters or fewer.`);
  }

  const gymName = text(input.gymName);
  if (!gymName) return fail("gymName", "REQUIRED", "Enter your academy name.");
  if (gymName.length > MAX_GYM_NAME) {
    return fail("gymName", "TOO_LONG", `Academy name must be ${MAX_GYM_NAME} characters or fewer.`);
  }

  const slugRaw = text(input.gymSlug);
  if (!slugRaw) return fail("gymSlug", "REQUIRED", "Choose your academy URL.");
  const gymSlug = normalizeSlug(slugRaw);
  if (gymSlug.length < MIN_SLUG) {
    return fail("gymSlug", "TOO_SHORT", `Academy URL must be at least ${MIN_SLUG} characters (letters, numbers, hyphens).`);
  }
  if (gymSlug.length > MAX_SLUG) {
    return fail("gymSlug", "TOO_LONG", `Academy URL must be ${MAX_SLUG} characters or fewer.`);
  }

  let timezone = DEFAULT_TIMEZONE;
  if (input.timezone !== undefined && input.timezone !== null && input.timezone !== "") {
    const tz = text(input.timezone);
    if (!tz || !(SUPPORTED_TIMEZONES as readonly string[]).includes(tz)) {
      return fail("timezone", "UNSUPPORTED_TIMEZONE", "Pick one of the supported time zones.");
    }
    timezone = tz;
  }

  return { ok: true, value: { firstName, lastName, email, phone, password, gymName, gymSlug, timezone } };
}
