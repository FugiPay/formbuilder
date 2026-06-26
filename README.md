# Dynamic Form Builder Engine

A configuration-driven engine that defines, validates, and stores dynamic forms, with a minimal UI to render and submit them. Built with the MERN stack (MongoDB, Express, React, Node) + TypeScript.

**Live demo (frontend):** https://form-builder-954ba.web.app/
**Live API:** https://formbuilder-9uul.onrender.com
**Repository:** https://github.com/FugiPay/formbuilder
**Test credentials:** none required — there's no auth layer in this prototype (see Trade-offs).

## How to run it locally

Requires Node 18+ and Docker (for MongoDB), or a local/Atlas MongoDB instance.

```bash
# 1. Start MongoDB
docker-compose up -d

# 2. Start the API (in one terminal)
cd server
cp .env.example .env
npm install
npm run seed     # loads two sample form configs: "contact-us" and "job-application"
npm run dev      # API listening on http://localhost:4000

# 3. Start the frontend (in a second terminal)
cd client
cp .env.example .env
npm install
npm run dev      # UI on http://localhost:5173
```

Run the test suite:

```bash
cd server
npm test
```

> Note: the API integration tests use `mongodb-memory-server`, which downloads a real `mongod` binary the first time it runs. That requires outbound access to `fastdl.mongodb.org`. The pure validation-engine unit tests (`tests/validation.test.ts`) have no such dependency and always run offline.

## Data model and key design decisions

Two collections:

```
FormConfig {
  _id, slug, name, version,
  schema: <JSON Schema>,
  uiSchema: <layout/label hints>,
  createdAt
}

FormSubmission {
  _id, formConfigId, formConfigSlug, formConfigVersion,
  data: <the actual answers>,
  createdAt
}
```

**Why JSON Schema + AJV instead of hardcoded validation.** The brief explicitly warns against `if (age < 18)`-style logic baked into the app. All field rules (`required`, `minLength`, `format`, `enum`, `pattern`, `minimum`/`maximum`, `additionalProperties`) live entirely in the stored `schema` document and are compiled and run by [AJV](https://ajv.js.org) at submit time (`server/src/validation/validate.ts`). The same `validateAgainstSchema()` function validates a contact form, a job application, or anything else — it has zero knowledge of what a "form" is.

**Why immutable, versioned configs instead of in-place edits.** A `FormConfig` document is never mutated once created. "Editing" a form means inserting a new document with the same `slug` and `version + 1`. A `FormSubmission` stores `formConfigId` pointing at the *exact version document* that validated it. This is what guarantees historical integrity: even if the `contact-us` form is edited five more times (tightening a field, removing a question), every past submission remains permanently retrievable alongside the precise schema it was checked against — `GET /submissions/:id` returns both. This is covered by an integration test (`tests/api.test.ts`) that edits a form after submission and confirms the old submission still resolves to its original version.

**Why MongoDB over a relational/JSONB hybrid.** Form configs are naturally document-shaped — nested, variable-shape, no fixed columns. Mongo lets the `schema` and `uiSchema` fields be native nested documents rather than a JSONB workaround on top of a relational engine. The trade-off (see below) is that nothing *structurally* stops a `FormSubmission.formConfigId` from pointing at a deleted document — that's handled in application code (the submission route looks the config up first and 404s if it's missing) rather than via a foreign-key constraint.

**Why `uiSchema` is separate from `schema`.** Validation rules and presentation (field order, labels, which widget to render — e.g. `textarea` vs single-line `text`, `select` vs free text) are different concerns that change at different rates. Keeping them in separate top-level fields means a label or field order can change without touching the validation contract, and vice versa.

## API

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/forms` | Create a form config. Re-posting an existing `slug` creates the next version. |
| `GET` | `/forms` | List the latest version of every form. |
| `GET` | `/forms/:slug` | Fetch the latest version of one form. |
| `GET` | `/forms/:slug/versions/:version` | Fetch a specific historical version. |
| `POST` | `/forms/:slug/submissions` | Validate + persist a submission against the latest version. |
| `GET` | `/forms/:slug/submissions` | List all submissions for a form, across versions. |
| `GET` | `/submissions/:id` | Fetch one submission plus the exact config version it was validated against. |

Validation failures return `400` with a structured `fieldErrors` array (`{ path, message }` per offending field) so the frontend can map errors directly onto inputs. Not-found cases return `404`; malformed IDs return `400`.

## Trade-offs and what I'd add with more time

- **No authentication.** The brief for Assignment A doesn't ask for roles/auth (unlike Assignment B), so this was deliberately left out to keep the surface small and focus effort on the validation engine itself. In production, `POST /forms` (creating/editing configs) would need to be restricted to an admin role.
- **No referential integrity at the DB layer.** Mongo doesn't enforce that `formConfigId` points at a real document. I handle the one case that matters (submitting against a form that doesn't exist → 404) in the route, but a stricter setup would add a periodic integrity check or switch the relation to a DB that enforces it.
- **Validation is schema-only, no cross-field rules.** AJV handles per-field constraints well but conditional logic ("require `coverLetter` only if `role` is X") would need JSON Schema's `if`/`then`/`else` keywords or a custom AJV keyword — I scoped this out to keep the validation engine itself easy to reason about and test.
- **No drag-and-drop form designer.** Per the brief, this wasn't required — configs are authored as raw JSON Schema documents (via `POST /forms` or the seed script). A real product would need an authoring UI; the engine underneath (storage + validation + rendering) wouldn't need to change.
- **With more time**, I'd add: a small admin UI for authoring/editing configs instead of raw JSON, conditional field visibility, and a "diff" view between two versions of the same form slug for the audit story.

## Deployment

This project is deployed and live:

- **Database:** MongoDB Atlas (free-tier cluster)
- **Backend:** Render — root directory `server`, build `npm install && npm run build`, start `npm start`, deployed at https://formbuilder-9uul.onrender.com
- **Frontend:** Firebase Hosting — built with `VITE_API_BASE_URL` pointed at the Render URL above, deployed at https://form-builder-954ba.web.app/

Both seed forms (`contact-us`, `job-application`) are loaded into the live database, and the full flow — render config → fill form → submit → validate → store — has been verified end-to-end against this deployment, including the validation-error path for invalid input.

`FRONTEND_URL` on Render is set to `https://form-builder-954ba.web.app,https://form-builder-954ba.firebaseapp.com,http://localhost:5173`, restricting the API to the deployed frontend and local dev — the same value is used in local `.env` for consistency.

### Reproducing this deployment

<details>
<summary>Steps to deploy your own copy (Atlas + Render + Firebase)</summary>

**1. Database — MongoDB Atlas**
1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Database Access → add a database user (username/password).
3. Network Access → add IP address `0.0.0.0/0` (Render's outbound IPs aren't static on the free tier).
4. Get the connection string from "Connect" → "Drivers":
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/formbuilder?retryWrites=true&w=majority`

**2. Backend — Render**
1. Push the repo to GitHub.
2. New → Web Service → connect the repo.
3. Root Directory: `server`; Build Command: `npm install && npm run build`; Start Command: `npm start`.
4. Environment variables: `MONGODB_URI` (from step 1), `FRONTEND_URL` (added after step 3).
5. Deploy, then seed once from your own machine: `MONGODB_URI="<atlas uri>" npm run seed`.
6. Verify: `curl https://<render-url>/health` → `{"status":"ok"}`.

**3. Frontend — Firebase Hosting**
1. In `client/.env.production`: `VITE_API_BASE_URL=https://<render-url>`.
2. `cd client && npm install && npm run build`.
3. `npm install -g firebase-tools && firebase login`.
4. `firebase init hosting` (public directory `dist`; keep the existing `firebase.json`).
5. `firebase deploy --only hosting`.

**4. (Optional) Restrict CORS**
On Render, set `FRONTEND_URL=https://<your>.web.app,https://<your>.firebaseapp.com` and restart.

</details>

## AI tool usage disclosure

**Tools used:** Claude (Anthropic), as the AI coding assistant for this project. (MongoDB Atlas, Render, and Firebase Hosting are the infrastructure used to deploy it, and VS Code was the local editor — covered in the Stack and Deployment sections above, not AI tools in themselves.)

**How I used it:** Scaffolding the project structure was done with the help of Claude, which understands the MERN stack well and generated the initial code and file layout — the Mongoose models, the Express routes, the AJV validation wrapper, the unit/integration tests, and the seed data. Claude also helped debug real deployment issues I hit on Render and Firebase, and helped polish this README into its current form (excluding this section).

**What I verified myself:** I confirmed that submissions pin to a `formConfigVersion` rather than just a config ID, which keeps an audit trail of which version of a form a given submission was validated against. AJV (Another JSON Validator) is one of the most widely used and fastest JSON Schema validators for JavaScript/Node.js. Each test in `api.test.ts` checks a specific piece of functionality — form versioning, submission validity, and historical integrity — and flags irregularities if any of those break. Getting CORS configuration, environment variables, Render's Root Directory setting, and the MongoDB Atlas connection all working together end-to-end required understanding how the full stack fits together, not just running commands — an understanding of the framework and the deployment pipeline was essential to get a working tool live and give users a good experience.

**What I'd add with more time:** Middleware to encrypt sensitive submission fields (e.g. email, phone number) in transit and at rest, paired with a clear, user-friendly confirmation message reassuring submitters that their data is handled securely.