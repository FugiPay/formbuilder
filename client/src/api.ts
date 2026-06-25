import type { ApiErrorBody, FormConfig } from "./types";

const API_BASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    ?.VITE_API_BASE_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  body: ApiErrorBody;
  status: number;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.status = status;
    this.body = body;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({
      error: "UnknownError",
      message: res.statusText,
    }))) as ApiErrorBody;
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

export async function listForms(): Promise<FormConfig[]> {
  const res = await fetch(`${API_BASE_URL}/forms`);
  return handle<FormConfig[]>(res);
}

export async function getForm(slug: string): Promise<FormConfig> {
  const res = await fetch(`${API_BASE_URL}/forms/${slug}`);
  return handle<FormConfig>(res);
}

export async function submitForm(
  slug: string,
  data: Record<string, unknown>
): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}/forms/${slug}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  return handle(res);
}
