export type PromptLlmProvider = "claude" | "runware" | "openrouter";

export interface AppSettings {
  anthropicApiKey: string;
  runwareApiKey: string;
  runwareModel: string;
  promptLlm: PromptLlmProvider;
  runwareLlmModel: string;
  openRouterApiKey: string;
  openRouterModel: string;
  enhancePrompts: boolean;
  batchConcurrency: number;
  removeBackground: boolean;
  videoModel: string;
  lastProjectPath: string | null;
  lastExportDir: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  anthropicApiKey: "",
  runwareApiKey: "",
  runwareModel: "runware:101@1",
  promptLlm: "claude",
  runwareLlmModel: "",
  openRouterApiKey: "",
  openRouterModel: "deepseek/deepseek-chat-v3-0324",
  enhancePrompts: true,
  batchConcurrency: 20,
  removeBackground: false,
  videoModel: "lightricks:ltx@2.3",
  lastProjectPath: null,
  lastExportDir: null,
};

export const OPENROUTER_MODEL_PRESETS = [
  { id: "deepseek/deepseek-chat-v3-0324", label: "DeepSeek V3 0324" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1" },
  { id: "meta-llama/llama-3.1-8b-instruct", label: "Llama 3.1 8B" },
  { id: "meta-llama/llama-3.1-70b-instruct", label: "Llama 3.1 70B" },
  { id: "google/gemini-2.5-flash-preview", label: "Gemini 2.5 Flash" },
  { id: "qwen/qwen-2.5-72b-instruct", label: "Qwen 2.5 72B" },
] as const;

export const RUNWARE_MODEL_PRESETS = [
  { id: "runware:101@1", label: "FLUX Dev", cost: "$0.0038/img" },
  { id: "runware:100@1", label: "FLUX Schnell", cost: "$0.0006/img" },
] as const;

export const VIDEO_MODEL_PRESETS = [
  // Budget
  { id: "prunaai:p-video@0", label: "P-Video", cost: "$0.02/s · ~$0.20/10s" },
  { id: "bytedance:seedance@1.5-pro", label: "Seedance 1.5 Pro", cost: "~$0.13/5s (720p)" },
  { id: "pixverse:1@7", label: "PixVerse v5.6", cost: "~$0.13/5s (720p)" },
  { id: "vidu:3@2", label: "Vidu Q2 Turbo", cost: "~$0.165/8s (720p)" },
  // Mid-range
  { id: "lightricks:ltx@2.3-fast", label: "LTX 2.3 Fast", cost: "$0.04/s · ~$0.40/10s" },
  { id: "vidu:4@2", label: "Vidu Q3 Turbo", cost: "$0.039/s · ~$0.39/10s (720p)" },
  { id: "vidu:4@1", label: "Vidu Q3", cost: "$0.046/s · ~$0.46/10s" },
  { id: "minimax:4@1", label: "MiniMax Hailuo 2.3", cost: "~$0.56/10s (768p)" },
  { id: "lightricks:ltx@2.3", label: "LTX 2.3", cost: "$0.06/s · ~$0.60/10s" },
  // Premium
  { id: "klingai:kling-video@3-standard", label: "Kling 3.0 Standard", cost: "$0.084/s · ~$0.84/10s" },
  { id: "klingai:kling-video@3-pro", label: "Kling 3.0 Pro", cost: "$0.112/s · ~$1.12/10s" },
] as const;
