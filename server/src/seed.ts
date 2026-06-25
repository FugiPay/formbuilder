import "dotenv/config";
import { connectDB, disconnectDB } from "./db";
import { FormConfig } from "./models/FormConfig";

const MONGODB_URI =
  process.env.MONGODB_URI ?? "mongodb://localhost:27017/formbuilder";

const contactForm = {
  slug: "contact-us",
  name: "Contact Us",
  schema: {
    type: "object",
    required: ["fullName", "email", "message"],
    additionalProperties: false,
    properties: {
      fullName: { type: "string", minLength: 2, maxLength: 100 },
      email: { type: "string", format: "email" },
      message: { type: "string", minLength: 10, maxLength: 1000 },
      newsletterOptIn: { type: "boolean" },
    },
  },
  uiSchema: {
    order: ["fullName", "email", "message", "newsletterOptIn"],
    labels: {
      fullName: "Full name",
      email: "Email address",
      message: "Your message",
      newsletterOptIn: "Subscribe to our newsletter",
    },
    widgets: {
      message: "textarea",
      newsletterOptIn: "checkbox",
    },
  },
};

// A more complex form to demonstrate enum/pattern/conditional-style rules
// living entirely in config - no application code knows what a
// "yearsOfExperience" field is.
const jobApplicationForm = {
  slug: "job-application",
  name: "Job Application",
  schema: {
    type: "object",
    required: ["fullName", "email", "role", "yearsOfExperience", "startDate"],
    additionalProperties: false,
    properties: {
      fullName: { type: "string", minLength: 2, maxLength: 100 },
      email: { type: "string", format: "email" },
      phone: {
        type: "string",
        pattern: "^\\+?[0-9 ()-]{7,20}$",
      },
      role: {
        type: "string",
        enum: ["Frontend Engineer", "Backend Engineer", "Full-Stack Engineer"],
      },
      yearsOfExperience: { type: "integer", minimum: 0, maximum: 50 },
      startDate: { type: "string", format: "date" },
      coverLetter: { type: "string", maxLength: 2000 },
    },
  },
  uiSchema: {
    order: [
      "fullName",
      "email",
      "phone",
      "role",
      "yearsOfExperience",
      "startDate",
      "coverLetter",
    ],
    labels: {
      fullName: "Full name",
      email: "Email address",
      phone: "Phone number",
      role: "Role applying for",
      yearsOfExperience: "Years of experience",
      startDate: "Available start date",
      coverLetter: "Cover letter",
    },
    widgets: {
      role: "select",
      coverLetter: "textarea",
      startDate: "date",
    },
  },
};

async function seed() {
  await connectDB(MONGODB_URI);

  for (const form of [contactForm, jobApplicationForm]) {
    const existing = await FormConfig.findOne({ slug: form.slug });
    if (existing) {
      console.log(`[seed] "${form.slug}" already exists, skipping`);
      continue;
    }
    const created = await FormConfig.create({ ...form, version: 1 });
    console.log(`[seed] created "${created.slug}" v${created.version}`);
  }

  await disconnectDB();
  console.log("[seed] done");
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
