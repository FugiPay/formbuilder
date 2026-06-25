import { describe, it, expect } from "vitest";
import { validateAgainstSchema } from "../src/validation/validate";

const schema = {
  type: "object",
  required: ["fullName", "email", "message"],
  additionalProperties: false,
  properties: {
    fullName: { type: "string", minLength: 2, maxLength: 100 },
    email: { type: "string", format: "email" },
    message: { type: "string", minLength: 10, maxLength: 1000 },
    newsletterOptIn: { type: "boolean" },
  },
};

describe("validateAgainstSchema", () => {
  it("accepts a fully valid payload", () => {
    const result = validateAgainstSchema(schema, {
      fullName: "Jane Doe",
      email: "jane@example.com",
      message: "Hello, this is a long enough message.",
      newsletterOptIn: true,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a payload missing required fields, listing all of them", () => {
    const result = validateAgainstSchema(schema, {
      fullName: "Jane Doe",
    });

    expect(result.valid).toBe(false);
    const missingPaths = result.errors.map((e) => e.path);
    expect(missingPaths).toContain("/email");
    expect(missingPaths).toContain("/message");
  });

  it("rejects an invalid email format", () => {
    const result = validateAgainstSchema(schema, {
      fullName: "Jane Doe",
      email: "not-an-email",
      message: "Hello, this is a long enough message.",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "/email")).toBe(true);
  });

  it("rejects a message that is too short", () => {
    const result = validateAgainstSchema(schema, {
      fullName: "Jane Doe",
      email: "jane@example.com",
      message: "short",
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "/message")).toBe(true);
  });

  it("rejects unexpected extra fields (additionalProperties: false)", () => {
    const result = validateAgainstSchema(schema, {
      fullName: "Jane Doe",
      email: "jane@example.com",
      message: "Hello, this is a long enough message.",
      isAdmin: true, // not in schema - should not be silently accepted
    });

    expect(result.valid).toBe(false);
  });

  it("is driven entirely by the schema - the same function validates a totally different shape", () => {
    const numericSchema = {
      type: "object",
      required: ["age"],
      properties: {
        age: { type: "integer", minimum: 18, maximum: 120 },
      },
    };

    expect(validateAgainstSchema(numericSchema, { age: 17 }).valid).toBe(
      false
    );
    expect(validateAgainstSchema(numericSchema, { age: 25 }).valid).toBe(
      true
    );
  });
});
