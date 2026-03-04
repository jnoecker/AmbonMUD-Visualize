import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import type { AppSettings } from "../types/settings";
import { DEFAULT_SETTINGS } from "../types/settings";
import { loadSettings, saveSettings } from "../lib/settings-io";

type SettingsAction =
  | { type: "SET_ALL"; settings: AppSettings }
  | { type: "UPDATE"; partial: Partial<AppSettings> };

function settingsReducer(state: AppSettings, action: SettingsAction): AppSettings {
  switch (action.type) {
    case "SET_ALL":
      return action.settings;
    case "UPDATE":
      return { ...state, ...action.partial };
  }
}

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  loaded: boolean;
}

const SettingsCtx = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  loaded: false,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, dispatch] = useReducer(settingsReducer, DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useReducer(() => true, false);

  useEffect(() => {
    loadSettings().then((s) => {
      dispatch({ type: "SET_ALL", settings: s });
      setLoaded();
    });
  }, []);

  const updateSettings = (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    dispatch({ type: "UPDATE", partial });
    saveSettings(next);
  };

  return (
    <SettingsCtx.Provider value={{ settings, updateSettings, loaded }}>
      {children}
    </SettingsCtx.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsCtx);
}
