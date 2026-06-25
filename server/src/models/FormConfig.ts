import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * A FormConfig represents one *version* of a form's definition.
 *
 * Versioning strategy:
 * - `slug` is the stable identifier for a logical form (e.g. "contact-us").
 * - `version` increments every time the form is edited; we never mutate
 *   an existing config in place. Editing a form = inserting a NEW document
 *   with the same slug and version + 1.
 * - This means a FormConfig document, once created, is immutable. Any
 *   FormSubmission that references it by _id will always be able to
 *   retrieve the exact schema it was validated against, even if the form
 *   has since been edited many times over.
 *
 * `schema` is a JSON Schema (draft-07 compatible, what AJV expects) describing
 * the fields, types, and validation rules. The validation engine
 * (see src/validation/validate.ts) compiles and runs this dynamically —
 * no field-specific logic is hardcoded in application code.
 *
 * `uiSchema` is optional presentation metadata (field order, labels, widget
 * hints) kept separate from validation rules, so "how it looks" and
 * "what's valid" can evolve independently.
 */
const FormConfigSchema = new Schema(
  {
    slug: { type: String, required: true, index: true },
    name: { type: String, required: true },
    version: { type: Number, required: true, default: 1 },
    schema: { type: Schema.Types.Mixed, required: true },
    uiSchema: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// A given slug can only have one document per version number.
FormConfigSchema.index({ slug: 1, version: 1 }, { unique: true });

export type FormConfigDoc = InferSchemaType<typeof FormConfigSchema>;
export const FormConfig = model("FormConfig", FormConfigSchema);
