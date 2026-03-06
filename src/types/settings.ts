export type PromptLlmProvider = "claude" | "runware";

export interface AppSettings {
  anthropicApiKey: string;
  runwareApiKey: string;
  runwareModel: string;
  promptLlm: PromptLlmProvider;
  runwareLlmModel: string;
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
  enhancePrompts: true,
  batchConcurrency: 20,
  removeBackground: false,
  videoModel: "lightricks:ltx@2.3",
  lastProjectPath: null,
  lastExportDir: null,
};

export const RUNWARE_MODEL_PRESETS = [
  { id: "runware:101@1", label: "FLUX Dev", cost: "$0.0038/img" },
  { id: "runware:100@1", label: "FLUX Schnell", cost: "$0.0006/img" },
] as const;

export const VIDEO_MODEL_PRESETS = [
  { id: "lightricks:ltx@2.3", label: "LTX 2.3", cost: "$0.06/vid" },
  { id: "lightricks:ltx@2.3-fast", label: "LTX 2.3 Fast", cost: "$0.04/vid" },
  { id: "prunaai:p-video@0", label: "P-Video", cost: "$0.02/vid" },
  { id: "vidu:3@2", label: "Vidu Q2 Turbo", cost: "$0.165/vid" },
  { id: "vidu:4@1", label: "Vidu Q3", cost: "$0.046/vid" },
  { id: "klingai:kling-video@3-standard", label: "Kling 3.0 Standard", cost: "$0.084/vid" },
  { id: "klingai:kling-video@3-pro", label: "Kling 3.0 Pro", cost: "$0.112/vid" },
] as const;
