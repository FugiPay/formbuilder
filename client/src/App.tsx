import { useEffect, useState } from "react";
import { ApiError, getForm, listForms, submitForm } from "./api";
import { FormRenderer } from "./FormRenderer";
import type { FieldError, FormConfig } from "./types";

type Status = "idle" | "loading" | "error" | "success";

export default function App() {
  const [forms, setForms] = useState<FormConfig[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [config, setConfig] = useState<FormConfig | null>(null);
  const [showSchema, setShowSchema] = useState(false);

  const [listStatus, setListStatus] = useState<Status>("loading");
  const [configStatus, setConfigStatus] = useState<Status>("idle");
  const [submitStatus, setSubmitStatus] = useState<Status>("idle");
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    listForms()
      .then((data) => {
        setForms(data);
        setListStatus("idle");
        if (data.length > 0) setSelectedSlug(data[0].slug);
      })
      .catch((err) => {
        setListStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to load forms");
      });
  }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    setConfigStatus("loading");
    setSubmitStatus("idle");
    setFieldErrors([]);
    getForm(selectedSlug)
      .then((data) => {
        setConfig(data);
        setConfigStatus("idle");
      })
      .catch((err) => {
        setConfigStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Failed to load form");
      });
  }, [selectedSlug]);

  async function handleSubmit(data: Record<string, unknown>) {
    if (!selectedSlug) return;
    setSubmitStatus("loading");
    setFieldErrors([]);
    try {
      await submitForm(selectedSlug, data);
      setSubmitStatus("success");
    } catch (err) {
      setSubmitStatus("error");
      if (err instanceof ApiError && err.body.fieldErrors) {
        setFieldErrors(err.body.fieldErrors);
        setErrorMessage("Some fields need attention.");
      } else {
        setErrorMessage(err instanceof Error ? err.message : "Submission failed");
      }
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow">Dynamic Form Builder Engine</p>
        <h1>Config in, form out.</h1>
        <p className="subhead">
          Every field below is generated from a stored JSON Schema — nothing
          here is hardcoded per form.
        </p>
      </header>

      {listStatus === "loading" && <p className="status-line">Loading forms…</p>}
      {listStatus === "error" && (
        <p className="status-line error">Couldn't reach the API: {errorMessage}</p>
      )}

      {listStatus === "idle" && forms.length === 0 && (
        <p className="status-line">
          No forms yet. Run the seed script (<code>npm run seed</code> in{" "}
          <code>server/</code>) to load sample configs.
        </p>
      )}

      {forms.length > 0 && (
        <div className="form-picker">
          <label htmlFor="form-select">Form</label>
          <select
            id="form-select"
            value={selectedSlug ?? ""}
            onChange={(e) => setSelectedSlug(e.target.value)}
          >
            {forms.map((f) => (
              <option key={f.slug} value={f.slug}>
                {f.name} (v{f.version})
              </option>
            ))}
          </select>
        </div>
      )}

      {configStatus === "loading" && <p className="status-line">Loading form…</p>}
      {configStatus === "error" && (
        <p className="status-line error">{errorMessage}</p>
      )}

      {config && configStatus === "idle" && (
        <div className="form-panel">
          <div className="form-panel-header">
            <div>
              <h2>{config.name}</h2>
              <p className="version-tag">
                slug: <code>{config.slug}</code> · version {config.version}
              </p>
            </div>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setShowSchema((s) => !s)}
            >
              {showSchema ? "Hide schema" : "View schema"}
            </button>
          </div>

          {showSchema && (
            <pre className="schema-view">
              {JSON.stringify(config.schema, null, 2)}
            </pre>
          )}

          {submitStatus === "success" ? (
            <div className="success-panel" role="status">
              <p className="success-title">Submission received.</p>
              <p>
                Validated against <code>{config.slug}</code> v{config.version}
                {' '}and stored.
              </p>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setSubmitStatus("idle")}
              >
                Submit another response
              </button>
            </div>
          ) : (
            <>
              {submitStatus === "error" && (
                <p className="status-line error" role="alert">
                  {errorMessage}
                </p>
              )}
              <FormRenderer
                config={config}
                fieldErrors={fieldErrors}
                onSubmit={handleSubmit}
                submitting={submitStatus === "loading"}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
