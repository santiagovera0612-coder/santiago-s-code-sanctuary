// Frontend HTTP client para llamar al backend Hono en /api/*.
//
// - Agrega `Authorization: Bearer <access_token>` con el JWT de la sesión
//   activa de Supabase. Si no hay sesión, llama igual (algunos endpoints
//   son públicos: /api/health, /api/webhooks/*).
// - Parsea JSON. Si el server devuelve { error, detail? } con status
//   >= 400, tira un ApiError que los componentes pueden atrapar para
//   mostrar el toast adecuado.
// - Nunca se silencia un error: el caller decide qué hacer pero el throw
//   siempre ocurre.

import { supabase } from "@/integrations/supabase/client";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;
  constructor(status: number, code: string, detail?: string) {
    super(`${code}${detail ? `: ${detail}` : ""}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

type Json = Record<string, unknown> | unknown[];

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith("/api/") ? path : `/api/${path.replace(/^\//, "")}`;
  const auth = await authHeader();

  const hasJsonBody =
    init.body !== undefined && init.body !== null && !(init.body instanceof FormData);

  const res = await fetch(url, {
    ...init,
    headers: {
      ...(hasJsonBody ? { "Content-Type": "application/json" } : {}),
      ...auth,
      ...(init.headers ?? {}),
    },
  });

  // Sin contenido → null
  if (res.status === 204) return null as T;

  const ct = res.headers.get("content-type") ?? "";
  const isJson = ct.includes("application/json");
  const payload = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const errCode =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `http_${res.status}`;
    const errDetail =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : undefined;
    throw new ApiError(res.status, errCode, errDetail);
  }

  return payload as T;
}

export const apiGet = <T = unknown>(path: string) => apiFetch<T>(path);

export const apiPost = <T = unknown>(path: string, body?: Json) =>
  apiFetch<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

export const apiPut = <T = unknown>(path: string, body?: Json) =>
  apiFetch<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined });

export const apiPatch = <T = unknown>(path: string, body?: Json) =>
  apiFetch<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });

export const apiDelete = <T = unknown>(path: string) => apiFetch<T>(path, { method: "DELETE" });
