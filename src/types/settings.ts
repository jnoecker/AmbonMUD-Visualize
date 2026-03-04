export interface AppSettings {
  anthropicApiKey: string;
  openaiApiKey: string;
  batchConcurrency: number;
  lastProjectPath: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  anthropicApiKey: "",
  openaiApiKey: "",
  batchConcurrency: 3,
  lastProjectPath: null,
};
