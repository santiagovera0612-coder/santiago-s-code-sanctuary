import { Hono, type Context } from "hono";
import { z } from "zod";
import { getServerSupabase } from "./supabase-server";
import type { AppEnv } from "./auth";
import { sendWhatsAppText } from "./whatsapp";
import { generateAgentReply, type AgentReplyMessage } from "./ai";

type JsonObject = Record<string, unknown>;

const maybeText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : undefined));

const textArraySchema = z.array(z.string().trim().min(1).max(500)).max(100).optional().default([]);

const contextItemSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["link", "pdf", "note"]),
  label: z.string().trim().min(1).max(240),
  value: z.string().trim().min(1).max(5000),
  size: z.number().int().nonnegative().optional(),
  storagePath: z.string().trim().max(1024).optional(),
  addedAt: z.string().datetime().optional(),
});

const agentSchema = z.object({
  businessName: z.string().trim().max(180).optional().default(""),
  businessType: z.string().trim().max(160).optional().default(""),
  agentName: z.string().trim().min(1).max(140),
  mainGoal: z.string().trim().max(1000).optional().default(""),
  tone: z.string().trim().max(120).optional().default("Cercano"),
  allowedTopics: textArraySchema,
  forbiddenClaims: textArraySchema,
  escalationRules: textArraySchema,
  hotLeadRules: textArraySchema,
  followUpRules: textArraySchema,
  operatingMode: z.enum(["suggest", "approve", "auto"]).optional().default("approve"),
  shortDescription: maybeText(1000),
  catalogEnabled: z.boolean().optional().default(true),
  logo: z
    .string()
    .trim()
    .max(4096)
    .optional()
    .refine((value) => !value || !value.startsWith("data:"), {
      message: "Los logos deben persistirse en Supabase Storage.",
    }),
  logoStoragePath: z.string().trim().max(1024).optional(),
  description: maybeText(5000),
  hours: maybeText(1000),
  country: maybeText(120),
  currency: maybeText(20),
  websiteUrl: maybeText(1000),
  instagramUrl: maybeText(1000),
  whatsappNumber: maybeText(120),
  contextItems: z.array(contextItemSchema).max(100).optional(),
  enabled: z.boolean().optional().default(true),
  tones: textArraySchema,
  instructions: maybeText(8000),
  language: maybeText(120),
  useEmojis: z.boolean().optional().default(false),
  escalateComplex: z.boolean().optional().default(true),
  prioritizeTone: z.boolean().optional().default(true),
  avatarUrl: maybeText(4096),
});

const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(240),
  description: maybeText(3000),
  category: maybeText(240),
  price: z.number().finite().nonnegative().optional(),
  currency: maybeText(20),
  stock: z.number().int().min(0).optional(),
  imageUrl: maybeText(4096),
  active: z.boolean().optional().default(true),
  aiNotes: maybeText(3000),
});

const productsPayloadSchema = z.object({
  products: z.array(productSchema).max(500),
});

const chatMessageSchema = z.object({
  text: z.string().trim().min(1).max(4000),
});

const chatHandlerSchema = z.object({
  handler: z.enum(["bot", "human"]),
});

const emptyBodySchema = z.object({}).strict();

const simulatorHistorySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const simulatorRespondSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().trim().min(1).max(4000),
  history: z.array(simulatorHistorySchema).max(20).optional().default([]),
});

const businessPayloadSchema = agentSchema
  .pick({
    businessName: true,
    businessType: true,
    logo: true,
    logoStoragePath: true,
    description: true,
    hours: true,
    country: true,
    currency: true,
    websiteUrl: true,
    instagramUrl: true,
    whatsappNumber: true,
  })
  .partial();

function isUuid(value: string | undefined): value is string {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

async function parseBody<T extends z.ZodTypeAny>(
  c: Context<AppEnv>,
  schema: T,
): Promise<z.infer<T> | Response> {
  let payload: unknown;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return c.json(
      {
        error: "validation_error",
        detail: parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
          .join("; "),
      },
      400,
    );
  }
  return parsed.data;
}

function normalizeLogoUrl(data: {
  logo?: string;
  logoStoragePath?: string;
}): string | null | undefined {
  if (data.logoStoragePath) return `storage:${data.logoStoragePath}`;
  if (data.logo !== undefined) return data.logo || null;
  return undefined;
}

async function signLogoUrl(
  supabase: ReturnType<typeof getServerSupabase>,
  stored: string | null | undefined,
): Promise<{ logo?: string; logoStoragePath?: string }> {
  if (!stored) return {};
  if (!stored.startsWith("storage:")) return { logo: stored };

  const logoStoragePath = stored.slice("storage:".length);
  const { data, error } = await supabase.storage
    .from("business-assets")
    .createSignedUrl(logoStoragePath, 60 * 60 * 24 * 7);

  if (error || !data?.signedUrl) {
    return { logoStoragePath };
  }
  return { logo: data.signedUrl, logoStoragePath };
}

function activityIcon(kind: string): "agent" | "product" | "rule" | "integration" {
  if (kind.startsWith("product")) return "product";
  if (kind.includes("rule")) return "rule";
  if (kind.includes("integration")) return "integration";
  return "agent";
}

const avatarBgs = [
  "bg-[#6366F1]",
  "bg-[#EC4899]",
  "bg-[#F59E0B]",
  "bg-[#10B981]",
  "bg-[#EF4444]",
  "bg-[#0EA5E9]",
];

const leadLabels: Record<string, string> = {
  nuevo: "Nuevo",
  interesado: "Interesado",
  caliente: "Caliente",
  seguimiento: "Seguimiento",
  cliente: "Cliente",
  perdido: "Perdido",
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "CL";
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function formatChatTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function mapMessage(row: JsonObject) {
  return {
    id: String(row.id),
    from: row.author,
    text: row.body,
    time: formatChatTime(String(row.created_at)),
    read: !!row.read_at,
  };
}

function mapConversation(row: JsonObject, messages: JsonObject[]) {
  const name = String(row.contact_name || row.contact_phone || row.contact_wa_id || "Cliente");
  const lead = String(row.lead_status || "nuevo");
  const lastMessage = String(row.last_message_preview || messages.at(-1)?.body || "").trim();
  const avatarBg = avatarBgs[hashString(String(row.id)) % avatarBgs.length];

  return {
    id: String(row.id),
    name,
    initials: initialsFor(name),
    avatarBg,
    channel: row.channel,
    lastMessage,
    createdAt: row.created_at,
    lastMessageAt: row.last_message_at ?? row.created_at,
    time: formatChatTime(String(row.last_message_at || row.created_at)),
    unread: Number(row.unread_count ?? 0),
    lead,
    handler: row.handler,
    messages: messages.map(mapMessage),
    info: {
      phone: row.contact_phone ?? undefined,
      oportunidad: lead === "caliente" || lead === "seguimiento",
      consulta: lastMessage || undefined,
      intencion: leadLabels[lead] ?? undefined,
    },
  };
}

async function readConversation(
  supabase: ReturnType<typeof getServerSupabase>,
  businessId: string,
  conversationId: string,
) {
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversation) return null;

  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("*")
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (messagesError) throw messagesError;

  return mapConversation(conversation, messages ?? []);
}

async function readAgent(supabase: ReturnType<typeof getServerSupabase>, businessId: string) {
  const [
    { data: business, error: businessError },
    { data: agent, error: agentError },
    { data: context, error: contextError },
  ] = await Promise.all([
    supabase.from("businesses").select("*").eq("id", businessId).single(),
    supabase.from("agents").select("*").eq("business_id", businessId).maybeSingle(),
    supabase
      .from("business_context_items")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
  ]);

  if (businessError) throw businessError;
  if (agentError) throw agentError;
  if (contextError) throw contextError;
  if (!agent) return null;

  const logo = await signLogoUrl(supabase, business.logo_url);
  const contextItems = (context ?? []).map((item: JsonObject) => ({
    id: String(item.id),
    type: item.type,
    label: item.label,
    value: item.value,
    size: item.size_bytes == null ? undefined : Number(item.size_bytes),
    storagePath: item.storage_path ?? undefined,
    addedAt: String(item.created_at),
  }));

  return {
    businessName: business.name ?? "",
    businessType: business.industry ?? "",
    agentName: agent.name ?? "",
    mainGoal: agent.main_goal ?? "",
    tone: agent.primary_tone ?? "",
    allowedTopics: agent.allowed_topics ?? [],
    forbiddenClaims: agent.forbidden_claims ?? [],
    escalationRules: agent.escalation_rules ?? [],
    hotLeadRules: agent.hot_lead_rules ?? [],
    followUpRules: agent.follow_up_rules ?? [],
    operatingMode: agent.operating_mode ?? "approve",
    aiProvider: agent.ai_provider ?? "anthropic",
    aiModel: agent.ai_model ?? "claude-sonnet-4-6",
    shortDescription: agent.short_description ?? undefined,
    catalogEnabled: agent.catalog_enabled ?? true,
    ...logo,
    description: business.description ?? agent.description ?? undefined,
    hours: business.hours ?? undefined,
    country: business.country ?? undefined,
    currency: business.currency ?? undefined,
    websiteUrl: business.website_url ?? undefined,
    instagramUrl: business.instagram_url ?? undefined,
    whatsappNumber: business.whatsapp_number ?? undefined,
    contextItems,
    enabled: agent.enabled ?? true,
    tones: agent.tones ?? [],
    instructions: agent.instructions ?? undefined,
    language: agent.language ?? undefined,
    useEmojis: agent.use_emojis ?? false,
    escalateComplex: agent.escalate_complex ?? true,
    prioritizeTone: agent.prioritize_tone ?? true,
    avatarUrl: agent.avatar_url ?? undefined,
  };
}

async function insertActivity(
  supabase: ReturnType<typeof getServerSupabase>,
  businessId: string,
  event: { kind: string; title: string; subtitle?: string },
) {
  const { error } = await supabase.from("activity_events").insert({
    business_id: businessId,
    kind: event.kind,
    title: event.title,
    subtitle: event.subtitle ?? null,
  });
  if (error) throw error;
}

export const crud = new Hono<AppEnv>();

crud.get("/agent", async (c) => {
  const supabase = getServerSupabase(c.env);
  const agent = await readAgent(supabase, c.var.businessId);
  return c.json({ agent });
});

crud.put("/agent", async (c) => {
  const parsed = await parseBody(c, agentSchema);
  if (parsed instanceof Response) return parsed;

  const supabase = getServerSupabase(c.env);
  const businessId = c.var.businessId;

  const { data: existing, error: existingError } = await supabase
    .from("agents")
    .select("id")
    .eq("business_id", businessId)
    .maybeSingle();
  if (existingError) throw existingError;

  const logoUrl = normalizeLogoUrl(parsed);
  const businessUpdate: JsonObject = {
    name: parsed.businessName,
    industry: parsed.businessType,
    description: parsed.description ?? null,
    hours: parsed.hours ?? null,
    country: parsed.country ?? null,
    currency: parsed.currency ?? null,
    website_url: parsed.websiteUrl ?? null,
    instagram_url: parsed.instagramUrl ?? null,
    whatsapp_number: parsed.whatsappNumber ?? null,
  };
  if (logoUrl !== undefined) businessUpdate.logo_url = logoUrl;

  const { error: businessError } = await supabase
    .from("businesses")
    .update(businessUpdate)
    .eq("id", businessId);
  if (businessError) throw businessError;

  const agentPayload = {
    business_id: businessId,
    name: parsed.agentName,
    main_goal: parsed.mainGoal,
    description: parsed.description ?? null,
    short_description: parsed.shortDescription ?? null,
    instructions: parsed.instructions ?? null,
    tones: parsed.tones,
    primary_tone: parsed.tone,
    language: parsed.language ?? "Español",
    use_emojis: parsed.useEmojis,
    escalate_complex: parsed.escalateComplex,
    prioritize_tone: parsed.prioritizeTone,
    enabled: parsed.enabled,
    avatar_url: parsed.avatarUrl ?? null,
    allowed_topics: parsed.allowedTopics,
    forbidden_claims: parsed.forbiddenClaims,
    escalation_rules: parsed.escalationRules,
    hot_lead_rules: parsed.hotLeadRules,
    follow_up_rules: parsed.followUpRules,
    operating_mode: parsed.operatingMode,
    catalog_enabled: parsed.catalogEnabled,
  };

  const { error: agentError } = await supabase
    .from("agents")
    .upsert(agentPayload, { onConflict: "business_id" });
  if (agentError) throw agentError;

  if (parsed.contextItems) {
    const { error: deleteError } = await supabase
      .from("business_context_items")
      .delete()
      .eq("business_id", businessId);
    if (deleteError) throw deleteError;

    if (parsed.contextItems.length) {
      const rows = parsed.contextItems.map((item) => ({
        ...(isUuid(item.id) ? { id: item.id } : {}),
        business_id: businessId,
        type: item.type,
        label: item.label,
        value: item.value,
        storage_path: item.storagePath ?? null,
        size_bytes: item.size ?? null,
      }));
      const { error: contextError } = await supabase.from("business_context_items").insert(rows);
      if (contextError) throw contextError;
    }
  }

  await insertActivity(supabase, businessId, {
    kind: existing ? "agent_updated" : "agent_created",
    title: existing ? "Se actualizó el Agente IA" : `${parsed.agentName} fue configurado`,
    subtitle: parsed.businessName
      ? `Listo para responder por ${parsed.businessName}`
      : "Listo para empezar a responder",
  });

  const agent = await readAgent(supabase, businessId);
  return c.json({ agent });
});

crud.delete("/agent", async (c) => {
  const supabase = getServerSupabase(c.env);
  const { error } = await supabase.from("agents").delete().eq("business_id", c.var.businessId);
  if (error) throw error;
  return c.json({ ok: true });
});

crud.get("/products", async (c) => {
  const supabase = getServerSupabase(c.env);
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", c.var.businessId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return c.json({
    products: (data ?? []).map((row: JsonObject) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      category: row.category ?? undefined,
      price: row.price == null ? undefined : Number(row.price),
      currency: row.currency ?? undefined,
      stock: row.stock == null ? undefined : Number(row.stock),
      imageUrl: row.image_url ?? undefined,
      active: row.active ?? true,
      aiNotes: row.ai_notes ?? undefined,
    })),
  });
});

crud.put("/products", async (c) => {
  const parsed = await parseBody(c, productsPayloadSchema);
  if (parsed instanceof Response) return parsed;

  const supabase = getServerSupabase(c.env);
  const businessId = c.var.businessId;

  const { data: existing, error: existingError } = await supabase
    .from("products")
    .select("id")
    .eq("business_id", businessId);
  if (existingError) throw existingError;
  const existingIds = new Set((existing ?? []).map((row: JsonObject) => String(row.id)));

  const { error: deleteError } = await supabase
    .from("products")
    .delete()
    .eq("business_id", businessId);
  if (deleteError) throw deleteError;

  if (parsed.products.length) {
    const rows = parsed.products.map((product) => ({
      ...(isUuid(product.id) ? { id: product.id } : {}),
      business_id: businessId,
      name: product.name,
      description: product.description ?? null,
      category: product.category ?? null,
      price: product.price ?? null,
      currency: product.currency ?? null,
      stock: product.stock ?? null,
      image_url: product.imageUrl ?? null,
      active: product.active,
      ai_notes: product.aiNotes ?? null,
    }));
    const { error: insertError } = await supabase.from("products").insert(rows);
    if (insertError) throw insertError;
  }

  const newProducts = parsed.products.filter((product) => !existingIds.has(product.id ?? ""));
  await Promise.all(
    newProducts.slice(0, 10).map((product) =>
      insertActivity(supabase, businessId, {
        kind: "product_added",
        title: `Se agregó "${product.name}" a tus productos`,
        subtitle: product.category,
      }),
    ),
  );

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return c.json({
    products: (data ?? []).map((row: JsonObject) => ({
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      category: row.category ?? undefined,
      price: row.price == null ? undefined : Number(row.price),
      currency: row.currency ?? undefined,
      stock: row.stock == null ? undefined : Number(row.stock),
      imageUrl: row.image_url ?? undefined,
      active: row.active ?? true,
      aiNotes: row.ai_notes ?? undefined,
    })),
  });
});

crud.get("/activity", async (c) => {
  const supabase = getServerSupabase(c.env);
  const { data, error } = await supabase
    .from("activity_events")
    .select("*")
    .eq("business_id", c.var.businessId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;

  return c.json({
    items: (data ?? []).map((row: JsonObject) => ({
      id: String(row.id),
      kind: row.kind,
      title: row.title,
      subtitle: row.subtitle ?? undefined,
      ts: row.created_at,
      icon: activityIcon(String(row.kind)),
    })),
  });
});

crud.get("/chats", async (c) => {
  const supabase = getServerSupabase(c.env);
  const businessId = c.var.businessId;
  const { data: conversations, error: conversationsError } = await supabase
    .from("conversations")
    .select("*")
    .eq("business_id", businessId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (conversationsError) throw conversationsError;

  const ids = (conversations ?? []).map((row: JsonObject) => String(row.id));
  const messagesByConversation = new Map<string, JsonObject[]>();
  if (ids.length) {
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("business_id", businessId)
      .in("conversation_id", ids)
      .order("created_at", { ascending: true });
    if (messagesError) throw messagesError;

    for (const message of messages ?? []) {
      const key = String(message.conversation_id);
      const list = messagesByConversation.get(key) ?? [];
      list.push(message);
      messagesByConversation.set(key, list);
    }
  }

  return c.json({
    conversations: (conversations ?? []).map((row: JsonObject) =>
      mapConversation(row, messagesByConversation.get(String(row.id)) ?? []),
    ),
  });
});

crud.post("/chats/:id/messages", async (c) => {
  const parsed = await parseBody(c, chatMessageSchema);
  if (parsed instanceof Response) return parsed;

  const conversationId = c.req.param("id");
  if (!isUuid(conversationId)) {
    return c.json({ error: "validation_error", detail: "id: UUID inválido" }, 400);
  }

  const supabase = getServerSupabase(c.env);
  const businessId = c.var.businessId;
  const { data: conversationRow, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError) throw conversationError;
  if (!conversationRow) return c.json({ error: "not_found" }, 404);

  const now = new Date().toISOString();
  let waMessageId: string | undefined;
  if (conversationRow.channel === "whatsapp") {
    const recipient = String(conversationRow.contact_wa_id ?? conversationRow.contact_phone ?? "");
    if (!recipient) {
      return c.json(
        { error: "whatsapp_recipient_missing", detail: "La conversacion no tiene destinatario." },
        409,
      );
    }
    waMessageId = await sendWhatsAppText(c.env, supabase, businessId, recipient, parsed.text);
  }

  const { error: insertError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    business_id: businessId,
    direction: "out",
    author: "human",
    body: parsed.text,
    wa_message_id: waMessageId ?? null,
    delivered_at: now,
  });
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      handler: "human",
      unread_count: 0,
      last_message_at: now,
      last_message_preview: parsed.text,
    })
    .eq("business_id", businessId)
    .eq("id", conversationId);
  if (updateError) throw updateError;

  const conversation = await readConversation(supabase, businessId, conversationId);
  return c.json({ conversation });
});

crud.patch("/chats/:id/handler", async (c) => {
  const parsed = await parseBody(c, chatHandlerSchema);
  if (parsed instanceof Response) return parsed;

  const conversationId = c.req.param("id");
  if (!isUuid(conversationId)) {
    return c.json({ error: "validation_error", detail: "id: UUID inválido" }, 400);
  }

  const supabase = getServerSupabase(c.env);
  const { error } = await supabase
    .from("conversations")
    .update({ handler: parsed.handler })
    .eq("business_id", c.var.businessId)
    .eq("id", conversationId);
  if (error) throw error;

  const conversation = await readConversation(supabase, c.var.businessId, conversationId);
  if (!conversation) return c.json({ error: "not_found" }, 404);
  return c.json({ conversation });
});

crud.patch("/chats/:id/read", async (c) => {
  const parsed = await parseBody(c, emptyBodySchema);
  if (parsed instanceof Response) return parsed;

  const conversationId = c.req.param("id");
  if (!isUuid(conversationId)) {
    return c.json({ error: "validation_error", detail: "id: UUID inválido" }, 400);
  }

  const supabase = getServerSupabase(c.env);
  const businessId = c.var.businessId;
  const now = new Date().toISOString();
  const { error: conversationError } = await supabase
    .from("conversations")
    .update({ unread_count: 0 })
    .eq("business_id", businessId)
    .eq("id", conversationId);
  if (conversationError) throw conversationError;

  const { error: messagesError } = await supabase
    .from("messages")
    .update({ read_at: now })
    .eq("business_id", businessId)
    .eq("conversation_id", conversationId)
    .eq("direction", "in")
    .is("read_at", null);
  if (messagesError) throw messagesError;

  const conversation = await readConversation(supabase, businessId, conversationId);
  if (!conversation) return c.json({ error: "not_found" }, 404);
  return c.json({ conversation });
});

crud.post("/simulator/respond", async (c) => {
  const parsed = await parseBody(c, simulatorRespondSchema);
  if (parsed instanceof Response) return parsed;
  if (parsed.sessionId && !isUuid(parsed.sessionId)) {
    return c.json({ error: "validation_error", detail: "sessionId: UUID invalido" }, 400);
  }

  const supabase = getServerSupabase(c.env);
  const businessId = c.var.businessId;
  let sessionId = parsed.sessionId;

  if (sessionId) {
    const { data: session, error: sessionError } = await supabase
      .from("simulator_sessions")
      .select("id")
      .eq("business_id", businessId)
      .eq("id", sessionId)
      .maybeSingle();
    if (sessionError) throw sessionError;
    if (!session) return c.json({ error: "not_found" }, 404);
  } else {
    const { data: session, error: createError } = await supabase
      .from("simulator_sessions")
      .insert({ business_id: businessId })
      .select("id")
      .single();
    if (createError) throw createError;
    sessionId = String(session.id);
  }

  const { error: userMessageError } = await supabase
    .from("simulator_messages")
    .insert({ session_id: sessionId, role: "user", content: parsed.message });
  if (userMessageError) throw userMessageError;

  let reply: string;
  try {
    reply = await generateAgentReply(c.env, supabase, {
      businessId,
      message: parsed.message,
      history: parsed.history as AgentReplyMessage[],
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "No se pudo generar la respuesta.";
    return c.json({ error: "anthropic_error", detail }, 502);
  }

  const { error: assistantMessageError } = await supabase
    .from("simulator_messages")
    .insert({ session_id: sessionId, role: "assistant", content: reply });
  if (assistantMessageError) throw assistantMessageError;

  return c.json({ reply, sessionId });
});

crud.get("/business", async (c) => {
  const supabase = getServerSupabase(c.env);
  const agent = await readAgent(supabase, c.var.businessId);
  return c.json({ business: agent });
});

crud.put("/business", async (c) => {
  const parsed = await parseBody(c, businessPayloadSchema);
  if (parsed instanceof Response) return parsed;

  const supabase = getServerSupabase(c.env);
  const logoUrl = normalizeLogoUrl(parsed);
  const update: JsonObject = {
    name: parsed.businessName ?? null,
    industry: parsed.businessType ?? null,
    description: parsed.description ?? null,
    hours: parsed.hours ?? null,
    country: parsed.country ?? null,
    currency: parsed.currency ?? null,
    website_url: parsed.websiteUrl ?? null,
    instagram_url: parsed.instagramUrl ?? null,
    whatsapp_number: parsed.whatsappNumber ?? null,
  };
  if (logoUrl !== undefined) update.logo_url = logoUrl;

  const { error } = await supabase.from("businesses").update(update).eq("id", c.var.businessId);
  if (error) throw error;

  return c.json({ business: await readAgent(supabase, c.var.businessId) });
});
