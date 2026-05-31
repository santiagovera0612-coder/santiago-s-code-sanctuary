import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.106.2";
import { z } from "npm:zod@3.24.2";

type JsonObject = Record<string, unknown>;

const DEFAULT_MODEL = "claude-sonnet-4-6";
const LEGACY_MODEL_ALIASES = new Map<string, string>([["claude-sonnet-4-20250514", DEFAULT_MODEL]]);
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const jobSchema = z.object({
  businessId: z.string().uuid(),
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const serviceRoleKey = readServiceRoleKey();
  if (!isAuthorized(req, serviceRoleKey)) {
    return json({ error: "unauthorized" }, 401);
  }

  let parsed: z.infer<typeof jobSchema>;
  try {
    parsed = jobSchema.parse(await req.json());
  } catch (error) {
    const detail = error instanceof z.ZodError ? error.message : "invalid_json";
    return json({ error: "validation_error", detail }, 400);
  }

  const supabase = createClient(requiredEnv("SUPABASE_URL"), serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    await processJob(supabase, parsed);
    return json({ ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "processor_error";
    await recordActivity(supabase, parsed.businessId, {
      kind: "integration_error",
      title: "No se pudo responder automaticamente",
      subtitle: detail.slice(0, 500),
      conversation_id: parsed.conversationId,
    });
    return json({ error: "processor_error", detail }, 502);
  }
});

async function processJob(supabase: SupabaseClient, job: z.infer<typeof jobSchema>) {
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("business_id", job.businessId)
    .eq("id", job.conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation || conversation.handler !== "bot") return;

  const { data: incoming, error: incomingError } = await supabase
    .from("messages")
    .select("*")
    .eq("business_id", job.businessId)
    .eq("conversation_id", job.conversationId)
    .eq("id", job.messageId)
    .eq("direction", "in")
    .maybeSingle();
  if (incomingError) throw incomingError;
  if (!incoming) return;

  const { data: historyRows, error: historyError } = await supabase
    .from("messages")
    .select("author, body")
    .eq("business_id", job.businessId)
    .eq("conversation_id", job.conversationId)
    .neq("id", job.messageId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (historyError) throw historyError;

  const history = (historyRows ?? []).reverse().map((row: JsonObject) => ({
    role: row.author === "client" ? "user" : "assistant",
    content: String(row.body ?? ""),
  }));

  const reply = await generateAgentReply(supabase, {
    businessId: job.businessId,
    message: String(incoming.body ?? ""),
    history,
  });

  const recipient = String(conversation.contact_wa_id ?? conversation.contact_phone ?? "");
  if (!recipient) throw new Error("La conversacion no tiene destinatario WhatsApp.");

  const waMessageId = await sendWhatsAppText(supabase, job.businessId, recipient, reply);
  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from("messages").insert({
    conversation_id: job.conversationId,
    business_id: job.businessId,
    direction: "out",
    author: "bot",
    body: reply,
    wa_message_id: waMessageId ?? null,
    delivered_at: now,
  });
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      last_message_at: now,
      last_message_preview: reply,
      handler: "bot",
    })
    .eq("business_id", job.businessId)
    .eq("id", job.conversationId);
  if (updateError) throw updateError;

  await recordActivity(supabase, job.businessId, {
    kind: "agent_replied",
    title: "El agente IA respondio en WhatsApp",
    subtitle: reply.slice(0, 180),
    conversation_id: job.conversationId,
  });
}

async function generateAgentReply(
  supabase: SupabaseClient,
  input: {
    businessId: string;
    message: string;
    history: Array<{ role: string; content: string }>;
  },
): Promise<string> {
  const anthropicKey = readAnthropicApiKey();
  const [
    { data: business, error: businessError },
    { data: agent, error: agentError },
    { data: products, error: productsError },
    { data: contextItems, error: contextError },
  ] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", input.businessId).single(),
    supabase.from("agents").select("*").eq("business_id", input.businessId).maybeSingle(),
    supabase
      .from("products")
      .select("*")
      .eq("business_id", input.businessId)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(30),
    supabase
      .from("business_context_items")
      .select("*")
      .eq("business_id", input.businessId)
      .order("created_at", { ascending: true })
      .limit(30),
  ]);

  if (businessError) throw businessError;
  if (agentError) throw agentError;
  if (productsError) throw productsError;
  if (contextError) throw contextError;
  if (!agent || agent.enabled === false) {
    throw new Error("Agente IA no configurado o desactivado.");
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: readAnthropicModel(agent as JsonObject),
      system: buildInstructions(
        business as JsonObject,
        agent as JsonObject,
        (products ?? []) as JsonObject[],
        (contextItems ?? []) as JsonObject[],
      ),
      messages: buildClaudeMessages(input.history, input.message),
      max_tokens: 380,
    }),
  });

  const payload = (await response.json().catch(() => null)) as JsonObject | null;
  if (!response.ok) {
    const error = payload?.error as JsonObject | undefined;
    const message = typeof error?.message === "string" ? error.message : `HTTP ${response.status}`;
    throw new Error(`Claude ${response.status}: ${message}`);
  }

  const reply = extractClaudeText(payload).slice(0, 1600);
  if (!reply) throw new Error("Claude no devolvio texto.");
  return reply;
}

function readAnthropicApiKey(): string {
  const value =
    Deno.env.get("ANTHROPIC_API_KEY") ||
    Deno.env.get("CLAUDE_API_KEY") ||
    Deno.env.get("CLAUDE_CODE_API_KEY");
  if (!value) throw new Error("ANTHROPIC_API_KEY no configurada.");
  return value;
}

function readAnthropicModel(agent?: JsonObject): string {
  const model =
    Deno.env.get("ANTHROPIC_MODEL") ||
    Deno.env.get("CLAUDE_MODEL") ||
    text(agent?.ai_model) ||
    DEFAULT_MODEL;
  return LEGACY_MODEL_ALIASES.get(model) ?? model;
}

function buildClaudeMessages(
  history: Array<{ role: string; content: string }>,
  currentMessage: string,
): Array<{ role: "user" | "assistant"; content: string }> {
  const normalized = [
    ...history
      .filter((message) => message.content.trim())
      .slice(-12)
      .map((message) => ({
        role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: message.content.trim().slice(0, 2000),
      })),
    { role: "user" as const, content: currentMessage.trim().slice(0, 4000) },
  ];

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const message of normalized) {
    const previous = messages[messages.length - 1];
    if (previous?.role === message.role) {
      previous.content = `${previous.content}\n\n${message.content}`.trim();
    } else {
      messages.push({ ...message });
    }
  }

  while (messages[0]?.role === "assistant") {
    messages.shift();
  }

  return messages.length ? messages : [{ role: "user", content: currentMessage.trim() }];
}

function buildInstructions(
  business: JsonObject,
  agent: JsonObject,
  products: JsonObject[],
  contextItems: JsonObject[],
): string {
  return [
    `Sos ${text(agent.name) || "el agente IA"} y respondes por ${text(business.name) || "el negocio"}.`,
    `Rubro: ${text(business.industry) || "no especificado"}.`,
    `Objetivo: ${text(agent.main_goal) || "ayudar al cliente y avanzar la conversacion comercial"}.`,
    `Tono: ${text(agent.primary_tone) || "cercano y claro"}. Idioma: ${text(agent.language) || "espanol"}.`,
    `Descripcion: ${text(business.description) || text(agent.description) || "no especificada"}.`,
    `Horarios: ${text(business.hours) || "no especificados"}.`,
    `Instrucciones internas: ${text(agent.instructions) || "sin instrucciones adicionales"}.`,
    `Temas permitidos: ${list(agent.allowed_topics) || "los relacionados con el negocio"}.`,
    `Afirmaciones prohibidas: ${list(agent.forbidden_claims) || "no inventes precios, stock, garantias ni politicas"}.`,
    `Reglas de escalamiento: ${list(agent.escalation_rules) || "si falta informacion, pedi que lo tome una persona"}.`,
    `Productos activos:\n${products.length ? products.map(formatProduct).join("\n") : "No hay productos cargados."}`,
    `Contexto adicional:\n${contextItems.length ? contextItems.map(formatContextItem).join("\n") : "No hay contexto adicional cargado."}`,
    "Reglas: responde breve y natural para WhatsApp; no inventes datos; pregunta algo concreto para avanzar; escala si corresponde.",
    agent.use_emojis ? "Podes usar pocos emojis." : "No uses emojis.",
  ].join("\n");
}

function normalizeRecipientForCloudApi(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("549") && digits.length === 13) {
    return `54${digits.slice(3)}`;
  }
  return digits;
}

async function sendWhatsAppText(
  supabase: SupabaseClient,
  businessId: string,
  to: string,
  textBody: string,
): Promise<string | undefined> {
  const { data: account, error } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!account) throw new Error("WhatsApp no esta conectado.");

  const token = await decryptSecret(String(account.access_token_encrypted));
  const version = Deno.env.get("WHATSAPP_API_VERSION") || "v25.0";
  const recipient = normalizeRecipientForCloudApi(to);
  const response = await fetch(
    `https://graph.facebook.com/${version}/${String(account.phone_number_id)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: { preview_url: false, body: textBody },
      }),
    },
  );

  const payload = (await response.json().catch(() => null)) as JsonObject | null;
  if (!response.ok) {
    const detail = payload?.error ? JSON.stringify(payload.error) : `HTTP ${response.status}`;
    await supabase
      .from("whatsapp_accounts")
      .update({ status: "error", last_error: detail.slice(0, 1000) })
      .eq("id", String(account.id));
    throw new Error(detail);
  }

  await supabase
    .from("whatsapp_accounts")
    .update({
      status: "active",
      last_error: null,
      activated_at: new Date().toISOString(),
    })
    .eq("id", String(account.id));

  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const first = messages[0] as JsonObject | undefined;
  return typeof first?.id === "string" ? first.id : undefined;
}

async function recordActivity(
  supabase: SupabaseClient,
  businessId: string,
  event: {
    kind: string;
    title: string;
    subtitle?: string;
    conversation_id?: string;
  },
) {
  await supabase.from("activity_events").insert({
    business_id: businessId,
    kind: event.kind,
    title: event.title,
    subtitle: event.subtitle ?? null,
    conversation_id: event.conversation_id ?? null,
  });
}

function isAuthorized(req: Request, serviceRoleKey: string): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const apikey = req.headers.get("apikey") ?? "";
  return auth === `Bearer ${serviceRoleKey}` || apikey === serviceRoleKey;
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} no configurada.`);
  return value;
}

function readServiceRoleKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    const names = JSON.parse(raw) as Record<string, string>;
    const defaultSecretName = names.default ?? names.service_role ?? Object.values(names)[0];
    const value = defaultSecretName ? Deno.env.get(defaultSecretName) : undefined;
    if (value) return value;
  }
  throw new Error("SUPABASE_SERVICE_ROLE_KEY no configurada.");
}

async function decryptSecret(encrypted: string): Promise<string> {
  const [version, ivPart, cipherPart] = encrypted.split(":");
  if (version !== "v1" || !ivPart || !cipherPart) {
    throw new Error("Formato de secreto cifrado invalido.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    parseEncryptionKey(requiredEnv("ENCRYPTION_KEY")),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlDecode(ivPart) },
    key,
    base64UrlDecode(cipherPart),
  );
  return new TextDecoder().decode(plain);
}

function parseEncryptionKey(raw: string): Uint8Array {
  const value = raw.trim();
  if (/^[0-9a-f]{64}$/i.test(value)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
  const decoded = base64Decode(value);
  if (decoded.length === 32) return decoded;
  throw new Error("ENCRYPTION_KEY debe tener 32 bytes en hex o base64.");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return base64Decode(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
}

function base64Decode(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function formatProduct(product: JsonObject): string {
  const price =
    product.price == null
      ? "precio no especificado"
      : `${text(product.currency) || ""} ${String(product.price)}`.trim();
  const stock = product.stock == null ? "stock no especificado" : `stock ${String(product.stock)}`;
  return `- ${text(product.name) || "Producto"}: ${text(product.description) || "sin descripcion"} (${price}; ${stock}; ${text(product.ai_notes) || "sin notas"})`;
}

function formatContextItem(item: JsonObject): string {
  return `- ${text(item.label) || text(item.type) || "Contexto"}: ${text(item.value).slice(0, 1000)}`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown): string {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
        .join("; ")
    : "";
}

function extractClaudeText(payload: JsonObject | null): string {
  if (!payload) return "";

  const content = Array.isArray(payload.content) ? payload.content : [];
  const parts: string[] = [];
  for (const contentItem of content as JsonObject[]) {
    if (contentItem.type === "text" && typeof contentItem.text === "string")
      parts.push(contentItem.text);
  }
  return parts.join("\n").trim();
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
