import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { FormConfig } from "../models/FormConfig";
import { FormSubmission } from "../models/FormSubmission";
import { validateAgainstSchema } from "../validation/validate";

export const formsRouter = Router();

function isValidObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * POST /forms
 * Create a new form config. If `slug` already exists, this creates the
 * NEXT version for that slug (version = max existing version + 1) rather
 * than overwriting anything - configs are immutable once created.
 */
formsRouter.post("/forms", async (req: Request, res: Response) => {
  const { slug, name, schema, uiSchema } = req.body ?? {};

  if (!slug || !name || !schema || typeof schema !== "object") {
    return res.status(400).json({
      error: "ValidationError",
      message: "slug, name, and schema (object) are required",
    });
  }

  const latest = await FormConfig.findOne({ slug }).sort({ version: -1 });
  const nextVersion = latest ? latest.version + 1 : 1;

  const config = await FormConfig.create({
    slug,
    name,
    version: nextVersion,
    schema,
    uiSchema: uiSchema ?? {},
  });

  return res.status(201).json(config);
});

/**
 * GET /forms
 * List the latest version of every distinct form slug.
 */
formsRouter.get("/forms", async (_req: Request, res: Response) => {
  const configs = await FormConfig.aggregate([
    { $sort: { slug: 1, version: -1 } },
    { $group: { _id: "$slug", doc: { $first: "$$ROOT" } } },
    { $replaceRoot: { newRoot: "$doc" } },
    { $sort: { slug: 1 } },
  ]);
  return res.json(configs);
});

/**
 * GET /forms/:slug
 * Fetch the LATEST version of a form by slug.
 */
formsRouter.get("/forms/:slug", async (req: Request, res: Response) => {
  const config = await FormConfig.findOne({ slug: req.params.slug }).sort({
    version: -1,
  });

  if (!config) {
    return res.status(404).json({
      error: "NotFound",
      message: `No form found with slug "${req.params.slug}"`,
    });
  }

  return res.json(config);
});

/**
 * GET /forms/:slug/versions/:version
 * Fetch a SPECIFIC version of a form. Used to re-render/audit an old
 * submission against the exact schema that produced it, even if the
 * form has since been edited.
 */
formsRouter.get(
  "/forms/:slug/versions/:version",
  async (req: Request, res: Response) => {
    const version = Number(req.params.version);
    if (!Number.isInteger(version)) {
      return res.status(400).json({
        error: "ValidationError",
        message: "version must be an integer",
      });
    }

    const config = await FormConfig.findOne({
      slug: req.params.slug,
      version,
    });

    if (!config) {
      return res.status(404).json({
        error: "NotFound",
        message: `No version ${version} found for slug "${req.params.slug}"`,
      });
    }

    return res.json(config);
  }
);

/**
 * POST /forms/:slug/submissions
 * Validate a submission payload against the LATEST version of the form's
 * schema, then persist it pinned to that exact version.
 */
formsRouter.post(
  "/forms/:slug/submissions",
  async (req: Request, res: Response) => {
    const config = await FormConfig.findOne({ slug: req.params.slug }).sort({
      version: -1,
    });

    if (!config) {
      return res.status(404).json({
        error: "NotFound",
        message: `No form found with slug "${req.params.slug}"`,
      });
    }

    const payload = req.body?.data;
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({
        error: "ValidationError",
        message: "Request body must include a 'data' object",
      });
    }

    const result = validateAgainstSchema(config.schema as object, payload);
    if (!result.valid) {
      return res.status(400).json({
        error: "ValidationError",
        message: "Submission failed validation",
        fieldErrors: result.errors,
      });
    }

    const submission = await FormSubmission.create({
      formConfigId: config._id,
      formConfigSlug: config.slug,
      formConfigVersion: config.version,
      data: payload,
    });

    return res.status(201).json(submission);
  }
);

/**
 * GET /forms/:slug/submissions
 * List all submissions for a form, across every version of that slug.
 */
formsRouter.get(
  "/forms/:slug/submissions",
  async (req: Request, res: Response) => {
    const submissions = await FormSubmission.find({
      formConfigSlug: req.params.slug,
    }).sort({ createdAt: -1 });
    return res.json(submissions);
  }
);

/**
 * GET /submissions/:id
 * Fetch a single submission together with the exact config version it
 * was validated against - the historical-integrity guarantee in action.
 */
formsRouter.get("/submissions/:id", async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    return res.status(400).json({
      error: "ValidationError",
      message: "Invalid submission id",
    });
  }

  const submission = await FormSubmission.findById(req.params.id);
  if (!submission) {
    return res.status(404).json({
      error: "NotFound",
      message: "Submission not found",
    });
  }

  const config = await FormConfig.findById(submission.formConfigId);

  return res.json({ submission, config });
});
