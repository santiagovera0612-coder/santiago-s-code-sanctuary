import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkerEnv } from "./supabase-server";

type JsonObject = Record<string, unknown>;

export type AgentReplyMessage = {
  role: "user" | "assistant";
  content: string;
};

type AgentReplyInput = {
  businessId: string;
  message: string;
  history?: AgentReplyMessage[];
};

type AgentContext = {
  business: JsonObject;
  agent: JsonObject;
  products: JsonObject[];
  contextItems: JsonObject[];
};

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const LEGACY_MODEL_ALIASES = new Map<string, string>([["claude-sonnet-4-20250514", DEFAULT_MODEL]]);

export async function generateAgentReply(
  env: WorkerEnv,
  supabase: SupabaseClient,
  input: AgentReplyInput,
): Promise<string> {
  const apiKey = getAnthropicApiKey(env);
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no configurada.");
  }

  const context = await loadAgentContext(supabase, input.businessId);
  if (!context.agent || context.agent.enabled === false) {
    throw new Error("Agente IA no configurado o desactivado.");
  }

  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getAnthropicModel(env, context.agent),
      system: buildInstructions(context),
      messages: buildClaudeMessages(input.history ?? [], input.message),
      max_tokens: 380,
    }),
  });

  const payload = (await response.json().catch(() => null)) as JsonObject | null;
  if (!response.ok) {
    throw new Error(anthropicErrorMessage(response.status, payload));
  }

  const text = extractClaudeText(payload);
  if (!text) {
    throw new Error("Claude no devolvio texto para responder.");
  }
  return text.slice(0, 1600);
}

function getAnthropicApiKey(env: WorkerEnv): string | undefined {
  return env.ANTHROPIC_API_KEY || env.CLAUDE_API_KEY || env.CLAUDE_CODE_API_KEY;
}

function getAnthropicModel(env: WorkerEnv, agent: JsonObject): string {
  return normalizeAnthropicModel(
    env.ANTHROPIC_MODEL || env.CLAUDE_MODEL || text(agent.ai_model) || DEFAULT_MODEL,
  );
}

function normalizeAnthropicModel(model: string): string {
  return LEGACY_MODEL_ALIASES.get(model) ?? model;
}

async function loadAgentContext(
  supabase: SupabaseClient,
  businessId: string,
): Promise<AgentContext> {
  const [
    { data: business, error: businessError },
    { data: agent, error: agentError },
    { data: products, error: productsError },
    { data: contextItems, error: contextError },
  ] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", businessId).single(),
    supabase.from("agents").select("*").eq("business_id", businessId).maybeSingle(),
    supabase
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .eq("active", true)
      .order("created_at", { ascending: true })
      .limit(30),
    supabase
      .from("business_context_items")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true })
      .limit(30),
  ]);

  if (businessError) throw businessError;
  if (agentError) throw agentError;
  if (productsError) throw productsError;
  if (contextError) throw contextError;
  if (!agent) throw new Error("Agente IA no configurado.");

  return {
    business: business as JsonObject,
    agent: agent as JsonObject,
    products: (products ?? []) as JsonObject[],
    contextItems: (contextItems ?? []) as JsonObject[],
  };
}

function buildClaudeMessages(
  history: AgentReplyMessage[],
  currentMessage: string,
): AgentReplyMessage[] {
  const normalized = [
    ...history
      .filter((message) => message.content.trim())
      .slice(-12)
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, 2000),
      })),
    { role: "user" as const, content: currentMessage.trim().slice(0, 4000) },
  ];

  const messages: AgentReplyMessage[] = [];
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

function buildInstructions(context: AgentContext): string {
  const { business, agent, products, contextItems } = context;
  const productLines = products.length
    ? products.map(formatProduct).join("\n")
    : "No hay productos cargados.";
  const contextLines = contextItems.length
    ? contextItems.map(formatContextItem).join("\n")
    : "No hay contexto adicional cargado.";

  return [
    `Sos ${text(agent.name) || "el agente IA"} y respondes por ${text(business.name) || "el negocio"}.`,
    `Rubro: ${text(business.industry) || "no especificado"}.`,
    `Objetivo principal: ${text(agent.main_goal) || "ayudar al cliente y avanzar la conversacion comercial"}.`,
    `Tono: ${text(agent.primary_tone) || "cercano y claro"}. Idioma: ${text(agent.language) || "espanol"}.`,
    `Descripcion del negocio: ${text(business.description) || text(agent.description) || "no especificada"}.`,
    `Horarios: ${text(business.hours) || "no especificados"}.`,
    `Instrucciones internas: ${text(agent.instructions) || "sin instrucciones adicionales"}.`,
    `Temas permitidos: ${list(agent.allowed_topics) || "los relacionados con el negocio"}.`,
    `Afirmaciones prohibidas: ${list(agent.forbidden_claims) || "no inventes precios, stock, garantias ni politicas"}.`,
    `Reglas de escalamiento: ${list(agent.escalation_rules) || "si falta informacion o el caso es sensible, pedi que lo tome una persona"}.`,
    `Productos activos:\n${productLines}`,
    `Contexto adicional:\n${contextLines}`,
    "Reglas de respuesta:",
    "- Responde solo con informacion presente en el contexto o pedile al cliente el dato que falta.",
    "- No inventes datos de stock, precios, tiempos, politicas, descuentos ni disponibilidad.",
    "- Escribi una respuesta breve, natural y lista para WhatsApp.",
    "- Si corresponde cerrar una venta, hace una pregunta concreta para avanzar.",
    "- Si el caso debe escalarse, decilo con calma y pedi un dato de contacto o espera de un asesor.",
    agent.use_emojis ? "- Podes usar pocos emojis si aportan claridad." : "- No uses emojis.",
  ].join("\n");
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

function anthropicErrorMessage(status: number, payload: JsonObject | null): string {
  const error = payload?.error as JsonObject | undefined;
  const message = typeof error?.message === "string" ? error.message : `HTTP ${status}`;
  return `Claude ${status}: ${message}`;
}

function extractClaudeText(payload: JsonObject | null): string {
  if (!payload) return "";

  const content = Array.isArray(payload.content) ? payload.content : [];
  const parts: string[] = [];
  for (const contentItem of content as JsonObject[]) {
    if (contentItem.type === "text" && typeof contentItem.text === "string") {
      parts.push(contentItem.text);
    }
  }
  return parts.join("\n").trim();
}
