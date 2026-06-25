import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * A FormSubmission stores the actual user-provided answers.
 *
 * Historical integrity: `formConfigId` points at the exact FormConfig
 * *version document* that validated this submission (FormConfig documents
 * are immutable - see FormConfig.ts). That means a submission is always
 * guaranteed to be valid against the schema referenced by formConfigId,
 * forever, regardless of how many times the form is edited afterwards.
 *
 * `formConfigSlug` and `formConfigVersion` are denormalized copies for
 * convenient querying/display (e.g. "show me all submissions for the
 * 'contact-us' form across every version") without an extra join/populate.
 */
const FormSubmissionSchema = new Schema(
  {
    formConfigId: {
      type: Schema.Types.ObjectId,
      ref: "FormConfig",
      required: true,
      index: true,
    },
    formConfigSlug: { type: String, required: true, index: true },
    formConfigVersion: { type: Number, required: true },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type FormSubmissionDoc = InferSchemaType<typeof FormSubmissionSchema>;
export const FormSubmission = model("FormSubmission", FormSubmissionSchema);
