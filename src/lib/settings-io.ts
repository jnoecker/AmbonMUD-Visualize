import {
  readTextFile,
  writeTextFile,
  exists,
  mkdir,
} from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import type { AppSettings } from "../types/settings";
import { DEFAULT_SETTINGS } from "../types/settings";

const SETTINGS_FILE = "settings.json";

async function getSettingsPath(): Promise<string> {
  const dir = await appDataDir();
  return join(dir, SETTINGS_FILE);
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const dir = await appDataDir();
    const dirExists = await exists(dir);
    if (!dirExists) {
      await mkdir(dir, { recursive: true });
    }

    const path = await getSettingsPath();
    const fileExists = await exists(path);
    if (!fileExists) {
      return { ...DEFAULT_SETTINGS };
    }

    const content = await readTextFile(path);
    const parsed = JSON.parse(content);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const dir = await appDataDir();
  const dirExists = await exists(dir);
  if (!dirExists) {
    await mkdir(dir, { recursive: true });
  }

  const path = await getSettingsPath();
  await writeTextFile(path, JSON.stringify(settings, null, 2));
}
