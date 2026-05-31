// Cliente Supabase server-side. Usa la SERVICE_ROLE_KEY → bypasea RLS.
// Sólo se instancia dentro de los handlers del Worker; nunca se importa
// desde código que corra en el browser.
//
// Pasamos `env` explícitamente porque en Cloudflare Workers las env vars
// llegan por argumento del fetch handler, no por process.env.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type WorkerEnv = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  CLAUDE_API_KEY?: string;
  CLAUDE_CODE_API_KEY?: string;
  CLAUDE_MODEL?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_API_VERSION?: string;
  ENCRYPTION_KEY?: string;
};

/** Cliente con permisos completos (service_role). Sólo backend. */
export function getServerSupabase(env: WorkerEnv): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no configuradas en el Worker.");
  }
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
