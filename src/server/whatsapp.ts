import { Hono, type Context } from "hono";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppEnv } from "./auth";
import { generateAgentReply, type AgentReplyMessage } from "./ai";
import { getServerSupabase, type WorkerEnv } from "./supabase-server";
import { decryptSecret, encryptSecret } from "./secrets";

type JsonObject = Record<string, unknown>;
type AutoReplyJob = {
  businessId: string;
  conversationId: string;
  messageId: string;
};

const accountSchema = z.object({
  phoneNumberId: z.string().trim().min(3).max(80),
  displayPhoneNumber: z.string().trim().max(80).optional(),
  accessToken: z.string().trim().min(20).max(4096).optional(),
});

const testMessageSchema = z.object({
  to: z.string().trim().min(5).max(32),
  text: z.string().trim().min(1).max(1000),
});

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

function publicAccount(row: JsonObject | null) {
  if (!row) return null;
  return {
    id: row.id,
    phoneNumberId: row.phone_number_id,
    displayPhoneNumber: row.display_phone_number ?? undefined,
    status: row.status,
    lastError: row.last_error ?? undefined,
    verifiedAt: row.verified_at ?? undefined,
    activatedAt: row.activated_at ?? undefined,
    createdAt: row.created_at,
  };
}

async function readBusinessAccount(
  supabase: SupabaseClient,
  businessId: string,
): Promise<JsonObject | null> {
  const { data, error } = await supabase
    .from("whatsapp_accounts")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function markAccountError(supabase: SupabaseClient, accountId: string, detail: string) {
  await supabase
    .from("whatsapp_accounts")
    .update({ status: "error", last_error: detail.slice(0, 1000) })
    .eq("id", accountId);
}

function normalizeRecipientForCloudApi(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("549") && digits.length === 13) {
    return `54${digits.slice(3)}`;
  }
  return digits;
}

export async function sendWhatsAppText(
  env: WorkerEnv,
  supabase: SupabaseClient,
  businessId: string,
  to: string,
  text: string,
): Promise<string | undefined> {
  const account = await readBusinessAccount(supabase, businessId);
  if (!account) throw new Error("WhatsApp no esta conectado.");

  const token = await decryptSecret(String(account.access_token_encrypted), env);
  const version = env.WHATSAPP_API_VERSION || "v25.0";
  const phoneNumberId = String(account.phone_number_id);
  const recipient = normalizeRecipientForCloudApi(to);
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: recipient,
      type: "text",
      text: { preview_url: false, body: text },
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && "error" in payload
        ? JSON.stringify((payload as { error: unknown }).error)
        : `HTTP ${response.status}`;
    await markAccountError(supabase, String(account.id), detail);
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

  const message = Array.isArray((payload as JsonObject)?.messages)
    ? ((payload as { messages: Array<{ id?: string }> }).messages[0] ?? null)
    : null;
  return message?.id;
}

async function verifySignature(
  env: WorkerEnv,
  signatureHeader: string | undefined,
  body: string,
): Promise<boolean> {
  if (!env.WHATSAPP_APP_SECRET) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.WHATSAPP_APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  );
  const expected = `sha256=${hex(digest)}`;
  return constantTimeEqual(expected, signatureHeader);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function messageText(message: JsonObject): string {
  const type = String(message.type ?? "");
  const text = message.text as JsonObject | undefined;
  if (type === "text" && text?.body) return String(text.body);
  const button = message.button as JsonObject | undefined;
  if (button?.text) return String(button.text);
  const interactive = message.interactive as JsonObject | undefined;
  const reply =
    (interactive?.button_reply as JsonObject | undefined) ??
    (interactive?.list_reply as JsonObject | undefined);
  if (reply?.title) return String(reply.title);
  return `[${type || "mensaje"} no soportado]`;
}

function hasWebhookChanges(payload: JsonObject): boolean {
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  return entries.some((entry) => {
    const changes = (entry as JsonObject).changes;
    return Array.isArray(changes) && changes.length > 0;
  });
}

async function rememberWebhookMessage(
  supabase: SupabaseClient,
  messageId: string,
): Promise<boolean> {
  const { error } = await supabase.from("webhook_dedupe").insert({ wa_message_id: messageId });
  if (!error) return true;
  if ((error as { code?: string }).code === "23505") return false;
  throw error;
}

async function upsertIncomingMessage(
  supabase: SupabaseClient,
  account: JsonObject,
  message: JsonObject,
  contactName?: string,
): Promise<AutoReplyJob | null> {
  const businessId = String(account.business_id);
  const waId = String(message.from ?? "");
  const messageId = String(message.id ?? "");
  if (!waId || !messageId) return null;
  if (!(await rememberWebhookMessage(supabase, messageId))) return null;

  const createdAt = message.timestamp
    ? new Date(Number(message.timestamp) * 1000).toISOString()
    : new Date().toISOString();
  const body = messageText(message);

  const { data: existing, error: existingError } = await supabase
    .from("conversations")
    .select("*")
    .eq("business_id", businessId)
    .eq("channel", "whatsapp")
    .eq("contact_wa_id", waId)
    .maybeSingle();
  if (existingError) throw existingError;

  let conversationId = existing?.id as string | undefined;
  let handler = "bot";
  if (!conversationId) {
    const { data: created, error: createError } = await supabase
      .from("conversations")
      .insert({
        business_id: businessId,
        channel: "whatsapp",
        contact_wa_id: waId,
        contact_phone: waId,
        contact_name: contactName ?? waId,
        lead_status: "nuevo",
        handler: "bot",
        unread_count: 1,
        last_message_at: createdAt,
        last_message_preview: body,
      })
      .select("id")
      .single();
    if (createError) throw createError;
    conversationId = String(created.id);
  } else {
    handler = String(existing.handler ?? "bot");
    const { error: updateError } = await supabase
      .from("conversations")
      .update({
        contact_name: contactName ?? existing.contact_name,
        contact_phone: waId,
        unread_count: Number(existing.unread_count ?? 0) + 1,
        last_message_at: createdAt,
        last_message_preview: body,
      })
      .eq("id", conversationId);
    if (updateError) throw updateError;
  }

  const { data: insertedMessage, error: messageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      business_id: businessId,
      direction: "in",
      author: "client",
      body,
      wa_message_id: messageId,
      created_at: createdAt,
    })
    .select("id")
    .single();
  if (messageError) throw messageError;

  await supabase.from("activity_events").insert({
    business_id: businessId,
    kind: "integration_pending",
    title: `Nuevo mensaje de ${contactName ?? waId}`,
    subtitle: body,
    conversation_id: conversationId,
  });

  if (handler !== "bot") return null;
  return {
    businessId,
    conversationId,
    messageId: String(insertedMessage.id),
  };
}

async function processStatuses(supabase: SupabaseClient, statuses: JsonObject[]) {
  for (const status of statuses) {
    const id = String(status.id ?? "");
    if (!id) continue;
    const timestamp = status.timestamp
      ? new Date(Number(status.timestamp) * 1000).toISOString()
      : new Date().toISOString();
    const state = String(status.status ?? "");
    const patch =
      state === "read"
        ? { read_at: timestamp, delivered_at: timestamp }
        : state === "delivered" || state === "sent"
          ? { delivered_at: timestamp }
          : null;
    if (!patch) continue;
    await supabase.from("messages").update(patch).eq("wa_message_id", id);
  }
}

async function processWebhookPayload(
  supabase: SupabaseClient,
  payload: JsonObject,
): Promise<AutoReplyJob[]> {
  const jobs: AutoReplyJob[] = [];
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  for (const entry of entries as JsonObject[]) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    for (const change of changes as JsonObject[]) {
      const value = (change.value ?? {}) as JsonObject;
      const metadata = (value.metadata ?? {}) as JsonObject;
      const phoneNumberId = String(metadata.phone_number_id ?? "");
      if (!phoneNumberId) continue;

      const { data: account, error } = await supabase
        .from("whatsapp_accounts")
        .select("*")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();
      if (error) throw error;
      if (!account) continue;

      if (Array.isArray(value.statuses)) {
        await processStatuses(supabase, value.statuses as JsonObject[]);
      }

      const contactsByWaId = new Map<string, string>();
      if (Array.isArray(value.contacts)) {
        for (const contact of value.contacts as JsonObject[]) {
          const profile = (contact.profile ?? {}) as JsonObject;
          contactsByWaId.set(String(contact.wa_id ?? ""), String(profile.name ?? ""));
        }
      }

      const messages = Array.isArray(value.messages) ? value.messages : [];
      for (const message of messages as JsonObject[]) {
        const job = await upsertIncomingMessage(
          supabase,
          account,
          message,
          contactsByWaId.get(String(message.from ?? "")) || undefined,
        );
        if (job) jobs.push(job);
      }

      await supabase
        .from("whatsapp_accounts")
        .update({
          status: "active",
          last_error: null,
          verified_at: new Date().toISOString(),
        })
        .eq("id", account.id);
    }
  }
  return jobs;
}

async function processAutoReply(
  env: WorkerEnv,
  supabase: SupabaseClient,
  job: AutoReplyJob,
): Promise<void> {
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

  const { data: existingBotReply, error: existingBotReplyError } = await supabase
    .from("messages")
    .select("id")
    .eq("business_id", job.businessId)
    .eq("conversation_id", job.conversationId)
    .eq("direction", "out")
    .eq("author", "bot")
    .gt("created_at", String(incoming.created_at ?? ""))
    .limit(1)
    .maybeSingle();
  if (existingBotReplyError) throw existingBotReplyError;
  if (existingBotReply) return;

  const { data: historyRows, error: historyError } = await supabase
    .from("messages")
    .select("author, body")
    .eq("business_id", job.businessId)
    .eq("conversation_id", job.conversationId)
    .neq("id", job.messageId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (historyError) throw historyError;

  const history: AgentReplyMessage[] = (historyRows ?? []).reverse().map((row: JsonObject) => ({
    role: row.author === "client" ? "user" : "assistant",
    content: String(row.body ?? ""),
  }));

  const reply = await generateAgentReply(env, supabase, {
    businessId: job.businessId,
    message: String(incoming.body ?? ""),
    history,
  });

  const recipient = String(conversation.contact_wa_id ?? conversation.contact_phone ?? "");
  if (!recipient) throw new Error("La conversacion no tiene destinatario WhatsApp.");

  const waMessageId = await sendWhatsAppText(env, supabase, job.businessId, recipient, reply);
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

  await supabase.from("activity_events").insert({
    business_id: job.businessId,
    kind: "agent_replied",
    title: "El agente IA respondio en WhatsApp",
    subtitle: reply.slice(0, 180),
    conversation_id: job.conversationId,
  });
}

async function recordAutoReplyError(env: WorkerEnv, job: AutoReplyJob, error: unknown) {
  const detail = error instanceof Error ? error.message : "processor_error";
  try {
    const supabase = getServerSupabase(env);
    await supabase.from("activity_events").insert({
      business_id: job.businessId,
      kind: "integration_error",
      title: "No se pudo responder automaticamente",
      subtitle: detail.slice(0, 500),
      conversation_id: job.conversationId,
    });
  } catch (recordError) {
    console.error("[whatsapp-processor-log]", recordError);
  }
}

function scheduleAutoReply(c: Context<AppEnv>, job: AutoReplyJob) {
  const supabase = getServerSupabase(c.env);
  const task = processAutoReply(c.env, supabase, job).catch((error) => {
    console.error("[whatsapp-processor]", error);
    void recordAutoReplyError(c.env, job, error);
  });
  let executionCtx: { waitUntil?: (promise: Promise<unknown>) => void } | undefined;
  try {
    executionCtx = (
      c as unknown as {
        executionCtx?: { waitUntil?: (promise: Promise<unknown>) => void };
      }
    ).executionCtx;
  } catch {
    executionCtx = undefined;
  }
  if (executionCtx?.waitUntil) {
    executionCtx.waitUntil(task);
  } else {
    void task;
  }
}

export const whatsappRoutes = new Hono<AppEnv>();

whatsappRoutes.get("/whatsapp/account", async (c) => {
  const supabase = getServerSupabase(c.env);
  const account = await readBusinessAccount(supabase, c.var.businessId);
  return c.json({
    account: publicAccount(account),
    verifyTokenConfigured: !!c.env.WHATSAPP_VERIFY_TOKEN,
    webhookPath: "/api/webhooks/whatsapp",
  });
});

whatsappRoutes.put("/whatsapp/account", async (c) => {
  const parsed = await parseBody(c, accountSchema);
  if (parsed instanceof Response) return parsed;
  if (!c.env.WHATSAPP_VERIFY_TOKEN) {
    return c.json({ error: "config_missing", detail: "WHATSAPP_VERIFY_TOKEN" }, 500);
  }

  const supabase = getServerSupabase(c.env);
  const existing = await readBusinessAccount(supabase, c.var.businessId);
  if (!existing && !parsed.accessToken) {
    return c.json({ error: "validation_error", detail: "accessToken: requerido" }, 400);
  }

  const encrypted = parsed.accessToken ? await encryptSecret(parsed.accessToken, c.env) : undefined;
  const row = {
    business_id: c.var.businessId,
    phone_number_id: parsed.phoneNumberId,
    display_phone_number: parsed.displayPhoneNumber ?? null,
    webhook_verify_token: c.env.WHATSAPP_VERIFY_TOKEN,
    status: "pending",
    last_error: null,
    ...(encrypted ? { access_token_encrypted: encrypted } : {}),
  };

  if (existing) {
    const { error } = await supabase
      .from("whatsapp_accounts")
      .update(row)
      .eq("id", String(existing.id));
    if (error) throw error;
  } else {
    const { error } = await supabase.from("whatsapp_accounts").insert(row);
    if (error) throw error;
  }

  const account = await readBusinessAccount(supabase, c.var.businessId);
  return c.json({ account: publicAccount(account) });
});

whatsappRoutes.post("/whatsapp/test", async (c) => {
  const parsed = await parseBody(c, testMessageSchema);
  if (parsed instanceof Response) return parsed;
  const supabase = getServerSupabase(c.env);
  const messageId = await sendWhatsAppText(
    c.env,
    supabase,
    c.var.businessId,
    parsed.to,
    parsed.text,
  );
  return c.json({ ok: true, messageId });
});

whatsappRoutes.get("/webhooks/whatsapp", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token && token === c.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return c.text(challenge, 200);
  }
  return c.text("Forbidden", 403);
});

whatsappRoutes.post("/webhooks/whatsapp", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("X-Hub-Signature-256");
  if (!(await verifySignature(c.env, signature, body))) {
    return c.json({ error: "invalid_signature" }, 401);
  }

  let payload: JsonObject;
  try {
    payload = JSON.parse(body) as JsonObject;
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }

  if (!hasWebhookChanges(payload)) {
    return c.json({ ok: true });
  }

  const supabase = getServerSupabase(c.env);
  const jobs = await processWebhookPayload(supabase, payload);
  for (const job of jobs) scheduleAutoReply(c, job);
  return c.json({ ok: true });
});
