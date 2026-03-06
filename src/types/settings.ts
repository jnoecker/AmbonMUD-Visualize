export interface AppSettings {
  anthropicApiKey: string;
  runwareApiKey: string;
  runwareModel: string;
  batchConcurrency: number;
  removeBackground: boolean;
  lastProjectPath: string | null;
  lastExportDir: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  anthropicApiKey: "",
  runwareApiKey: "",
  runwareModel: "runware:101@1",
  batchConcurrency: 20,
  removeBackground: false,
  lastProjectPath: null,
  lastExportDir: null,
};

export const RUNWARE_MODEL_PRESETS = [
  { id: "runware:101@1", label: "FLUX Dev", cost: "$0.0038/img" },
  { id: "runware:100@1", label: "FLUX Schnell", cost: "$0.0006/img" },
] as const;
