// Real Supabase client. Reemplaza el stub localStorage que vivía acá
// antes de la Fase 2 (backend real). La API expuesta (`supabase.auth.*`,
// `supabase.from(...)`, `supabase.storage.*`, `supabase.channel(...)`) es
// la nativa de @supabase/supabase-js — los 5 archivos que importan
// `supabase` siguen funcionando sin cambios porque el stub respetaba la
// misma forma.
//
// Variables esperadas en .env / .dev.vars:
//   VITE_SUPABASE_URL
//   VITE_SUPABASE_ANON_KEY
// Ver .env.example para los detalles.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function getSupabaseConfigError(): string | null {
  if (!url || !anonKey) {
    return "Supabase no está configurado. Definí VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local o .dev.vars.";
  }

  try {
    new URL(url);
  } catch {
    return "VITE_SUPABASE_URL no es una URL válida. Copiá la Project URL desde Supabase.";
  }

  if (anonKey.trim().length < 20 || anonKey.includes("placeholder")) {
    return "VITE_SUPABASE_ANON_KEY parece incompleta. Copiá la anon public key o publishable key completa desde Supabase.";
  }

  return null;
}

export const supabaseConfigError = getSupabaseConfigError();

export function isSupabaseConfigured(): boolean {
  return supabaseConfigError === null;
}

if (supabaseConfigError && typeof window !== "undefined") {
  // No tiramos en build/SSR porque rompería el render. Las pantallas que
  // ejecutan acciones de auth muestran este mismo mensaje con toast.

  console.error(`[supabase] ${supabaseConfigError}`);
}

export const supabase: SupabaseClient = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-anon-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);
