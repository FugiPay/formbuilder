# Dynamic Form Builder Engine

A configuration-driven engine that defines, validates, and stores dynamic forms, with a minimal UI to render and submit them. Built with the MERN stack (MongoDB, Express, React, Node) + TypeScript.

**Live demo:** `TODO — add your deployed URL here`
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

## Deploying it (MongoDB Atlas + Render + Firebase Hosting)

### 1. Database — MongoDB Atlas

1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas).
2. Database Access → add a database user (username/password).
3. Network Access → add IP address `0.0.0.0/0` (allow from anywhere — Render's outbound IPs aren't static on the free tier).
4. Get your connection string from "Connect" → "Drivers" — it looks like:
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/formbuilder?retryWrites=true&w=majority`

### 2. Backend — Render

1. Push this repo to GitHub (Render deploys from a git repo).
2. In Render: New → Web Service → connect your repo.
3. **Root Directory:** `server`
4. **Build Command:** `npm install && npm run build`
5. **Start Command:** `npm start`
6. Environment variables:
   - `MONGODB_URI` → your Atlas connection string from step 1
   - `FRONTEND_URL` → leave blank for now, you'll add it after step 3
7. Deploy. Once live, note the URL (e.g. `https://form-builder-api.onrender.com`).
8. Seed the deployed database once: easiest way is to run `MONGODB_URI="<your atlas uri>" npm run seed` from your own machine (it just needs network access to Atlas, not to Render).
9. Sanity check: `curl https://your-render-url.onrender.com/health` → `{"status":"ok"}`.

### 3. Frontend — Firebase Hosting

1. In `client/.env.production`, set:
   ```
   VITE_API_BASE_URL=https://your-render-url.onrender.com
   ```
   (Vite bakes env vars in at build time, so this must exist before you build.)
2. Build it: `cd client && npm install && npm run build` → outputs to `client/dist`.
3. Install the Firebase CLI if you don't have it: `npm install -g firebase-tools`.
4. `firebase login`
5. From the `client` directory: `firebase init hosting` — choose "Use an existing project" (or create one), and when asked for the public directory, confirm `dist` (the included `firebase.json` already points at it; you can skip overwriting it).
6. `firebase deploy --only hosting`
7. Note the hosting URL it prints (e.g. `https://your-app.web.app`).

### 4. Close the loop — lock down CORS

Go back to Render → your service → Environment, and set:

```
FRONTEND_URL=https://your-app.web.app,https://your-app.firebaseapp.com
```

(Firebase gives you both domains by default.) Redeploy/restart the Render service so it picks up the new env var. Without this step the API works for everyone with `origin: true`, which is fine for an assessment but worth tightening since you're already set up for it.

### 5. Verify end-to-end

Visit your Firebase URL, confirm the form picker loads (proves the frontend can reach Render), submit a form, and confirm you get the success state (proves Render can reach Atlas). Put the Firebase URL at the top of this README as your live demo link.

## AI tool usage disclosure

I used Claude (Anthropic) as a coding assistant throughout this exercise — for scaffolding the project structure (server/client folder layout, package.json/tsconfig setup), generating the initial Mongoose models and AJV validation wrapper, drafting the Express routes and their corresponding Vitest unit/integration tests, and writing this README.

What I verified myself: I read through and understand every file in this repo, including the versioning logic in the `/forms` POST handler, the AJV error-path mapping in `validate.ts`, and the historical-integrity guarantee tested in `api.test.ts`. I ran the type-checker (`tsc --noEmit`) and the full test suite locally and confirmed the validation unit tests pass; [confirm here whether you were able to run the Mongo-backed integration tests in your own environment, since they need network access to download a `mongod` binary on first run]. I can explain the reasoning behind every design decision listed above, including why versioned-immutable configs were chosen over in-place edits.

*(Personalize this section with your own account of how you used AI tools before submitting — the brief specifically asks for this in your own words.)*
