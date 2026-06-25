export interface JsonSchemaProperty {
  type: string;
  format?: string;
  enum?: string[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
}

export interface JsonSchema {
  type: "object";
  required?: string[];
  properties: Record<string, JsonSchemaProperty>;
  additionalProperties?: boolean;
}

export interface UiSchema {
  order?: string[];
  labels?: Record<string, string>;
  widgets?: Record<string, string>;
}

export interface FormConfig {
  _id: string;
  slug: string;
  name: string;
  version: number;
  schema: JsonSchema;
  uiSchema: UiSchema;
  createdAt: string;
}

export interface FieldError {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  error: string;
  message: string;
  fieldErrors?: FieldError[];
}
