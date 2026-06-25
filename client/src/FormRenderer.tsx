import { useState } from "react";
import type { FieldError, FormConfig, JsonSchemaProperty } from "./types";

interface FormRendererProps {
  config: FormConfig;
  fieldErrors: FieldError[];
  onSubmit: (data: Record<string, unknown>) => void;
  submitting: boolean;
}

function fieldErrorFor(path: string, errors: FieldError[]): string | undefined {
  // AJV paths look like "/email" - field keys are "email"
  return errors.find((e) => e.path === `/${path}`)?.message;
}

/**
 * Renders a single field based purely on its JSON Schema description plus
 * an optional widget hint from the uiSchema. There is no per-form, per-field
 * branching here that's specific to any one form - "role" and "email" are
 * rendered by the exact same code path as any other enum/string field.
 */
function FieldInput({
  name,
  spec,
  widget,
  value,
  onChange,
}: {
  name: string;
  spec: JsonSchemaProperty;
  widget?: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const id = `field-${name}`;

  if (spec.type === "boolean" || widget === "checkbox") {
    return (
      <input
        id={id}
        type="checkbox"
        checked={Boolean(value)}
        onChange={(e) => onChange(e.target.checked)}
      />
    );
  }

  if (spec.enum || widget === "select") {
    return (
      <select
        id={id}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled>
          Select…
        </option>
        {(spec.enum ?? []).map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (widget === "textarea") {
    return (
      <textarea
        id={id}
        rows={4}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (spec.format === "date" || widget === "date") {
    return (
      <input
        id={id}
        type="date"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (spec.type === "integer" || spec.type === "number") {
    return (
      <input
        id={id}
        type="number"
        value={(value as number | string) ?? ""}
        min={spec.minimum}
        max={spec.maximum}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
      />
    );
  }

  if (spec.format === "email") {
    return (
      <input
        id={id}
        type="email"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      id={id}
      type="text"
      value={(value as string) ?? ""}
      minLength={spec.minLength}
      maxLength={spec.maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** A small mono "spec tag" showing the raw JSON Schema constraint for a field. */
function SpecTag({ spec }: { spec: JsonSchemaProperty }) {
  const parts = [spec.type];
  if (spec.format) parts.push(spec.format);
  if (spec.enum) parts.push("enum");
  if (spec.minLength !== undefined || spec.maxLength !== undefined) {
    parts.push(`len ${spec.minLength ?? 0}–${spec.maxLength ?? "∞"}`);
  }
  if (spec.minimum !== undefined || spec.maximum !== undefined) {
    parts.push(`${spec.minimum ?? "-∞"}…${spec.maximum ?? "∞"}`);
  }
  return <code className="spec-tag">{parts.join(" · ")}</code>;
}

export function FormRenderer({
  config,
  fieldErrors,
  onSubmit,
  submitting,
}: FormRendererProps) {
  const { schema, uiSchema } = config;
  const fieldNames =
    uiSchema?.order && uiSchema.order.length > 0
      ? uiSchema.order
      : Object.keys(schema.properties);

  const [values, setValues] = useState<Record<string, unknown>>({});

  function setField(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="dynamic-form" noValidate>
      {fieldNames.map((name) => {
        const spec = schema.properties[name];
        if (!spec) return null;
        const isRequired = schema.required?.includes(name);
        const label = uiSchema?.labels?.[name] ?? name;
        const widget = uiSchema?.widgets?.[name];
        const error = fieldErrorFor(name, fieldErrors);

        return (
          <div className="field" key={name}>
            <div className="field-header">
              <label htmlFor={`field-${name}`}>
                {label}
                {isRequired && <span className="required-mark"> *</span>}
              </label>
              <SpecTag spec={spec} />
            </div>
            <FieldInput
              name={name}
              spec={spec}
              widget={widget}
              value={values[name]}
              onChange={(v) => setField(name, v)}
            />
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </div>
        );
      })}

      <button type="submit" disabled={submitting} className="submit-btn">
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </form>
  );
}
