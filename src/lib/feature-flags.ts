type FeatureFlag = "whatsappV2";

const truthyValues = new Set(["1", "true", "yes", "on"]);

function readBooleanFlag(value: unknown): boolean {
  return typeof value === "string" && truthyValues.has(value.trim().toLowerCase());
}

export const whatsappV2Enabled = readBooleanFlag(import.meta.env.VITE_WHATSAPP_V2_ENABLED);

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  if (flag === "whatsappV2") return whatsappV2Enabled;
  return false;
}
