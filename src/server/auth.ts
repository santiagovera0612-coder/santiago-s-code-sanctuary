// Middleware de autenticación para el router Hono de /api/*.
//
// Lee `Authorization: Bearer <jwt>` del request, valida el JWT contra
// Supabase Auth (usando el cliente con service_role) y expone en
// el contexto de Hono:
//   c.var.userId      → uuid del usuario autenticado
//   c.var.businessId  → uuid del business asociado (creado por el trigger
//                       on_auth_user_created en la migration 0001)
//
// Si el token falta o es inválido → 401.
// Excepciones (endpoints públicos): /api/health, /api/webhooks/*

import type { MiddlewareHandler } from "hono";
import { getServerSupabase, type WorkerEnv } from "./supabase-server";

export type AppEnv = {
  Bindings: WorkerEnv;
  Variables: {
    userId: string;
    businessId: string;
    userEmail: string;
  };
};

/** Rutas que NO requieren auth (orden importa: prefijo más largo primero). */
const PUBLIC_PREFIXES = ["/api/webhooks/", "/api/health"];

function isPublic(path: string): boolean {
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p));
}

export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (isPublic(path)) {
    return next();
  }

  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return c.json({ error: "missing_token" }, 401);
  }

  const supabase = getServerSupabase(c.env);

  // Validar el JWT contra Supabase Auth.
  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return c.json({ error: "invalid_token" }, 401);
  }

  // Resolver el business asociado (lo crea el trigger on_auth_user_created).
  const { data: business, error: bizErr } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (bizErr) {
    return c.json({ error: "db_error", detail: bizErr.message }, 500);
  }
  if (!business) {
    // No debería ocurrir si el trigger está activo. Es un estado roto:
    // devolvemos 409 para que el frontend lo pueda manejar (re-login).
    return c.json({ error: "business_not_provisioned" }, 409);
  }

  c.set("userId", userData.user.id);
  c.set("businessId", business.id);
  c.set("userEmail", userData.user.email ?? "");

  return next();
};
