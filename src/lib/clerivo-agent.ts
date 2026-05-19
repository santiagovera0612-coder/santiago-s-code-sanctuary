// Shared client-side helpers to read the Agent + Catalog that the user
// created in /app/create (everything lives in localStorage in Fase 1).

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
};

const STORAGE_AGENT = "clerivo:agent";
const STORAGE_PRODUCTS = "clerivo:products";

export function getStoredAgent(): StoredAgent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_AGENT);
    return raw ? (JSON.parse(raw) as StoredAgent) : null;
  } catch {
    return null;
  }
}

export function getStoredProducts(): StoredProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_PRODUCTS);
    return raw ? (JSON.parse(raw) as StoredProduct[]) : [];
  } catch {
    return [];
  }
}

export function useHasAgent(): { agent: StoredAgent | null; loaded: boolean } {
  // Tiny hook implemented without React import to avoid cycles — callers
  // wrap in their own useState/useEffect when they need reactivity.
  return { agent: getStoredAgent(), loaded: typeof window !== "undefined" };
}
