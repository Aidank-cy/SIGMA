"use client";

import { LLMSettingsView } from "./LLMSettingsParts";
import { useLLMSettingsPanelState } from "./LLMSettingsState";
import type { LLMSettingsPanelProps } from "./LLMSettingsState";

export {
  llmConfigsEqual,
  normalizedLLMConfig,
  normalizedLLMConfigForSave
} from "./LLMSettingsLogic";

export function LLMSettingsPanel(props: LLMSettingsPanelProps) {
  const state = useLLMSettingsPanelState(props);
  return <LLMSettingsView state={state} />;
}
