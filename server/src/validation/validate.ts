import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";

export interface FieldError {
  /** Dot/slash path to the offending field, e.g. "/email" */
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

/**
 * A single shared AJV instance. `allErrors: true` so we collect every
 * violation in one pass instead of failing fast on the first field -
 * this is what lets the frontend show all validation errors at once.
 */
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv); // adds "email", "date", "date-time", etc. as usable formats

/**
 * Validate an arbitrary payload against an arbitrary JSON Schema.
 *
 * This function has zero knowledge of what fields exist - it is the same
 * function whether the schema describes a contact form, a survey, or a
 * legal disclosure. All field-specific rules (required, min/max, pattern,
 * format, enum, etc.) live in the schema document, not in this code.
 *
 * We compile fresh per-call rather than caching by schema identity, since
 * AJV compilation is cheap for schemas of this size and it keeps this
 * function pure / side-effect free (no cache invalidation to reason about
 * when a form is edited and a new version is created).
 */
export function validateAgainstSchema(
  schema: object,
  payload: unknown
): ValidationResult {
  const validateFn = ajv.compile(schema);
  const valid = validateFn(payload) as boolean;

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors = (validateFn.errors ?? []).map(toFieldError);
  return { valid: false, errors };
}

function toFieldError(err: ErrorObject): FieldError {
  // AJV gives paths like "/email" for property errors, or "" for
  // root-level errors (e.g. "must be object"). Fall back to instancePath
  // or the missing property name for "required" errors.
  let path = err.instancePath;
  if (!path && err.keyword === "required") {
    path = `/${(err.params as { missingProperty?: string }).missingProperty ?? ""}`;
  }
  return {
    path: path || "/",
    message: err.message ?? "Invalid value",
  };
}
