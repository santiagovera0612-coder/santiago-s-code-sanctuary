import { supabase } from "@/integrations/supabase/client";
import { apiGet, apiPatch, apiPost } from "./api-client";

export type ChatChannel = "whatsapp" | "instagram";
export type ChatHandler = "bot" | "human";
export type LeadStatus =
  | "nuevo"
  | "interesado"
  | "caliente"
  | "seguimiento"
  | "cliente"
  | "perdido";

export type ChatMessage = {
  id: string;
  from: "client" | "bot" | "human";
  text: string;
  time: string;
  read?: boolean;
};

export type CustomerInfo = {
  phone?: string;
  oportunidad?: boolean;
  resumen?: string;
  consulta?: string;
  intencion?: string;
  producto?: string;
  proximaAccion?: string;
};

export type ChatConversation = {
  id: string;
  name: string;
  initials: string;
  avatarBg: string;
  channel: ChatChannel;
  lastMessage: string;
  createdAt?: string;
  lastMessageAt?: string;
  time: string;
  unread: number;
  lead: LeadStatus;
  handler: ChatHandler;
  messages: ChatMessage[];
  info?: CustomerInfo;
};

type ChatsResponse = { conversations: ChatConversation[] };
type ChatResponse = { conversation: ChatConversation };

export async function fetchChatConversations(): Promise<ChatConversation[]> {
  const { conversations } = await apiGet<ChatsResponse>("chats");
  return conversations;
}

export async function sendChatMessage(
  conversationId: string,
  text: string,
): Promise<ChatConversation> {
  const { conversation } = await apiPost<ChatResponse>(`chats/${conversationId}/messages`, {
    text,
  });
  return conversation;
}

export async function setChatHandler(
  conversationId: string,
  handler: ChatHandler,
): Promise<ChatConversation> {
  const { conversation } = await apiPatch<ChatResponse>(`chats/${conversationId}/handler`, {
    handler,
  });
  return conversation;
}

export async function markChatRead(conversationId: string): Promise<ChatConversation> {
  const { conversation } = await apiPatch<ChatResponse>(`chats/${conversationId}/read`, {});
  return conversation;
}

export function subscribeToChatRealtime(onChange: () => void, onError: () => void): () => void {
  const channel = supabase
    .channel(`clerivo-chats-${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, onChange)
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") onError();
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
