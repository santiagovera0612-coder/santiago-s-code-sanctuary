import { supabase } from "@/integrations/supabase/client";
import { apiDelete, apiGet, apiPut } from "./api-client";

export type ContextItem = {
  id: string;
  type: "link" | "pdf" | "note";
  label: string;
  value: string;
  size?: number;
  storagePath?: string;
  addedAt: string;
};

export type StoredAgent = {
  businessName: string;
  businessType: string;
  agentName: string;
  mainGoal: string;
  tone: string;
  allowedTopics?: string[];
  forbiddenClaims?: string[];
  escalationRules?: string[];
  hotLeadRules?: string[];
  followUpRules?: string[];
  operatingMode?: "suggest" | "approve" | "auto";
  shortDescription?: string;
  catalogEnabled?: boolean;
  logo?: string;
  logoStoragePath?: string;
  description?: string;
  hours?: string;
  country?: string;
  currency?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  whatsappNumber?: string;
  contextItems?: ContextItem[];
  enabled?: boolean;
  tones?: string[];
  instructions?: string;
  language?: string;
  useEmojis?: boolean;
  escalateComplex?: boolean;
  prioritizeTone?: boolean;
  avatarUrl?: string;
};

export type StoredProduct = {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price?: number;
  currency?: string;
  stock?: number;
  imageUrl?: string;
  active: boolean;
  aiNotes?: string;
};

type AgentResponse = { agent: StoredAgent | null };
type ProductsResponse = { products: StoredProduct[] };
type MeResponse = { businessId: string };

const STORAGE_BUCKET = "business-assets";

export async function getStoredAgent(): Promise<StoredAgent | null> {
  if (typeof window === "undefined") return null;
  const { agent } = await apiGet<AgentResponse>("agent");
  return agent;
}

export async function getStoredProducts(): Promise<StoredProduct[]> {
  if (typeof window === "undefined") return [];
  const { products } = await apiGet<ProductsResponse>("products");
  return products;
}

export function useHasAgent(): { agent: StoredAgent | null; loaded: boolean } {
  return { agent: null, loaded: false };
}

export async function saveStoredAgent(agent: StoredAgent): Promise<StoredAgent> {
  const { agent: saved } = await apiPut<AgentResponse>(
    "agent",
    agent as unknown as Record<string, unknown>,
  );
  if (!saved) throw new Error("No se pudo guardar el agente.");
  dispatchActivity();
  return saved;
}

export async function deleteStoredAgent(): Promise<void> {
  await apiDelete("agent");
  dispatchActivity();
}

export async function saveStoredProducts(products: StoredProduct[]): Promise<StoredProduct[]> {
  const response = await apiPut<ProductsResponse>("products", {
    products: products as unknown as Record<string, unknown>[],
  });
  dispatchActivity();
  return response.products;
}

export async function updateStoredAgent(patch: Partial<StoredAgent>): Promise<StoredAgent | null> {
  const current = await getStoredAgent();
  if (!current) return null;
  return saveStoredAgent({ ...current, ...patch });
}

export async function uploadBusinessLogo(
  file: File,
): Promise<{ logo: string; logoStoragePath: string }> {
  const path = await uploadBusinessAsset(file, "logos");

  const { data, error: signedError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);

  if (signedError || !data?.signedUrl) {
    throw new Error(signedError?.message ?? "No se pudo firmar el logo.");
  }

  return { logo: data.signedUrl, logoStoragePath: path };
}

export async function uploadBusinessContextFile(file: File): Promise<{ storagePath: string }> {
  const storagePath = await uploadBusinessAsset(file, "context");
  return { storagePath };
}

async function uploadBusinessAsset(file: File, folder: "logos" | "context"): Promise<string> {
  const { businessId } = await apiGet<MeResponse>("me");
  const safeName = sanitizeFileName(file.name || "logo");
  const path = `${businessId}/${folder}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) throw new Error(uploadError.message);
  return path;
}

function sanitizeFileName(name: string): string {
  const clean = name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return clean || "logo";
}

function dispatchActivity() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("clerivo:activity"));
}
