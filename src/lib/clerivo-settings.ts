import { apiGet, apiPut } from "./api-client";

export type BusinessSettings = {
  name: string;
  industry: string;
  country: string;
  currency: string;
  hours: string;
  description: string;
};

export type AgentSettings = {
  name: string;
  goal: string;
  tone: string;
  mode: string;
};

export type ChannelsSettings = {
  whatsapp_enabled: boolean;
  instagram_enabled: boolean;
};

export type RulesSettings = {
  can_do: string;
  cannot_invent: string;
  handoff_when: string;
  must_ask: string;
};

export type ClerivoSettings = {
  business: BusinessSettings;
  agent: AgentSettings;
  channels: ChannelsSettings;
  rules: RulesSettings;
};

export const DEFAULT_SETTINGS: ClerivoSettings = {
  business: {
    name: "",
    industry: "servicios",
    country: "ar",
    currency: "ars",
    hours: "",
    description: "",
  },
  agent: {
    name: "Sofia",
    goal: "responder",
    tone: "cercano",
    mode: "sugerir",
  },
  channels: {
    whatsapp_enabled: false,
    instagram_enabled: false,
  },
  rules: {
    can_do: "",
    cannot_invent: "",
    handoff_when: "",
    must_ask: "",
  },
};

type BusinessResponse = {
  business: {
    businessName?: string;
    businessType?: string;
    country?: string;
    currency?: string;
    hours?: string;
    description?: string;
    agentName?: string;
    mainGoal?: string;
    tone?: string;
    operatingMode?: string;
    allowedTopics?: string[];
    forbiddenClaims?: string[];
    escalationRules?: string[];
  } | null;
};

export async function loadSettings(): Promise<ClerivoSettings> {
  const { business } = await apiGet<BusinessResponse>("business");
  if (!business) return DEFAULT_SETTINGS;

  return {
    business: {
      name: business.businessName ?? "",
      industry: business.businessType ?? DEFAULT_SETTINGS.business.industry,
      country: business.country ?? DEFAULT_SETTINGS.business.country,
      currency: business.currency ?? DEFAULT_SETTINGS.business.currency,
      hours: business.hours ?? "",
      description: business.description ?? "",
    },
    agent: {
      name: business.agentName ?? DEFAULT_SETTINGS.agent.name,
      goal: business.mainGoal ?? DEFAULT_SETTINGS.agent.goal,
      tone: business.tone ?? DEFAULT_SETTINGS.agent.tone,
      mode: business.operatingMode ?? DEFAULT_SETTINGS.agent.mode,
    },
    channels: DEFAULT_SETTINGS.channels,
    rules: {
      can_do: (business.allowedTopics ?? []).join("\n"),
      cannot_invent: (business.forbiddenClaims ?? []).join("\n"),
      handoff_when: (business.escalationRules ?? []).join("\n"),
      must_ask: "",
    },
  };
}

export async function saveSettingsSection<K extends keyof ClerivoSettings>(
  key: K,
  value: ClerivoSettings[K],
): Promise<ClerivoSettings> {
  const current = await loadSettings();
  const next: ClerivoSettings = { ...current, [key]: value };

  if (key === "business") {
    await apiPut("business", {
      businessName: next.business.name,
      businessType: next.business.industry,
      country: next.business.country,
      currency: next.business.currency,
      hours: next.business.hours,
      description: next.business.description,
    });
  }

  if (key === "agent" || key === "rules") {
    await apiPut("agent", {
      businessName: next.business.name,
      businessType: next.business.industry,
      agentName: next.agent.name,
      mainGoal: next.agent.goal,
      tone: next.agent.tone,
      operatingMode: next.agent.mode,
      allowedTopics: splitLines(next.rules.can_do),
      forbiddenClaims: splitLines(next.rules.cannot_invent),
      escalationRules: splitLines(next.rules.handoff_when),
    });
  }

  return next;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}
