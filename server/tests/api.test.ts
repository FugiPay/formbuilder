import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app";
import { FormConfig } from "../src/models/FormConfig";
import { FormSubmission } from "../src/models/FormSubmission";

let mongod: MongoMemoryServer;
const app = createApp();

const contactSchema = {
  type: "object",
  required: ["fullName", "email", "message"],
  additionalProperties: false,
  properties: {
    fullName: { type: "string", minLength: 2 },
    email: { type: "string", format: "email" },
    message: { type: "string", minLength: 10 },
  },
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});

beforeEach(async () => {
  await FormConfig.deleteMany({});
  await FormSubmission.deleteMany({});
});

describe("POST /forms", () => {
  it("creates version 1 for a brand new slug", async () => {
    const res = await request(app).post("/forms").send({
      slug: "contact-us",
      name: "Contact Us",
      schema: contactSchema,
    });

    expect(res.status).toBe(201);
    expect(res.body.version).toBe(1);
  });

  it("creates version 2 when posting again with the same slug, without mutating version 1", async () => {
    await request(app)
      .post("/forms")
      .send({ slug: "contact-us", name: "Contact Us", schema: contactSchema });

    const res = await request(app)
      .post("/forms")
      .send({ slug: "contact-us", name: "Contact Us v2", schema: contactSchema });

    expect(res.status).toBe(201);
    expect(res.body.version).toBe(2);

    const allVersions = await FormConfig.find({ slug: "contact-us" });
    expect(allVersions).toHaveLength(2);
  });

  it("rejects a config missing required top-level fields", async () => {
    const res = await request(app).post("/forms").send({ name: "No slug" });
    expect(res.status).toBe(400);
  });
});

describe("POST /forms/:slug/submissions", () => {
  beforeEach(async () => {
    await request(app)
      .post("/forms")
      .send({ slug: "contact-us", name: "Contact Us", schema: contactSchema });
  });

  it("accepts a valid submission and pins it to the current config version", async () => {
    const res = await request(app)
      .post("/forms/contact-us/submissions")
      .send({
        data: {
          fullName: "Jane Doe",
          email: "jane@example.com",
          message: "Hello there, this is my message.",
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.formConfigVersion).toBe(1);
  });

  it("rejects an invalid submission with structured field errors", async () => {
    const res = await request(app)
      .post("/forms/contact-us/submissions")
      .send({ data: { fullName: "J" } });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ValidationError");
    expect(Array.isArray(res.body.fieldErrors)).toBe(true);
    expect(res.body.fieldErrors.length).toBeGreaterThan(0);
  });

  it("returns 404 for a submission against a form slug that doesn't exist", async () => {
    const res = await request(app)
      .post("/forms/does-not-exist/submissions")
      .send({ data: {} });

    expect(res.status).toBe(404);
  });

  it("keeps an old submission valid against its original version after the form is edited", async () => {
    const submitRes = await request(app)
      .post("/forms/contact-us/submissions")
      .send({
        data: {
          fullName: "Jane Doe",
          email: "jane@example.com",
          message: "Hello there, this is my message.",
        },
      });
    const submissionId = submitRes.body._id;

    // Now edit the form - tighten message minLength so the old payload
    // would actually fail validation against the NEW version.
    await request(app).post("/forms").send({
      slug: "contact-us",
      name: "Contact Us v2",
      schema: {
        ...contactSchema,
        properties: {
          ...contactSchema.properties,
          message: { type: "string", minLength: 500 },
        },
      },
    });

    const fetchRes = await request(app).get(`/submissions/${submissionId}`);
    expect(fetchRes.status).toBe(200);
    // The submission is still linked to version 1, not the new version 2
    expect(fetchRes.body.submission.formConfigVersion).toBe(1);
    expect(fetchRes.body.config.version).toBe(1);
  });
});

describe("authorization-style not-found / bad-input handling", () => {
  it("returns 400 for a malformed submission id", async () => {
    const res = await request(app).get("/submissions/not-a-valid-id");
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed but nonexistent submission id", async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/submissions/${fakeId}`);
    expect(res.status).toBe(404);
  });
});
