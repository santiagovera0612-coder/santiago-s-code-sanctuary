// Router HTTP del backend de CLERIVO. Todo lo que matchea /api/* pasa
// por acá; el resto va al SSR de TanStack Start (ver src/server.ts).
//
// Convenciones:
// - Todos los endpoints autenticados leen `c.var.userId` y `c.var.businessId`
//   provistos por authMiddleware.
// - Las validaciones de body usan Zod desde dentro de cada handler.
// - Errores devueltos como { error: "code", detail?: "..." } con status
//   apropiado. El api-client del frontend traduce esto a toasts.

import { Hono } from "hono";
import { authMiddleware, type AppEnv } from "./auth";
import { crud } from "./crud";
import { whatsappRoutes } from "./whatsapp";

export const api = new Hono<AppEnv>().basePath("/api");

// Auth para todo excepto los endpoints públicos (health + webhooks).
api.use("*", authMiddleware);

// ─── Health ─────────────────────────────────────────────────────────────
api.get("/health", (c) => {
  return c.json({ ok: true, ts: new Date().toISOString() });
});

// Stub auth-required para validar el middleware end-to-end.
// Se reemplaza por los endpoints reales en los bloques B-F.
api.get("/me", (c) => {
  return c.json({
    userId: c.var.userId,
    businessId: c.var.businessId,
    email: c.var.userEmail,
  });
});

api.route("/", whatsappRoutes);
api.route("/", crud);

// Fallback 404 para cualquier /api/* no implementado.
api.notFound((c) => c.json({ error: "not_found" }, 404));

// Error handler global → log + 500.
api.onError((err, c) => {
  console.error("[api]", err);
  return c.json({ error: "internal", detail: err.message }, 500);
});
