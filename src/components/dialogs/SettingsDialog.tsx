import { useState } from "react";
import { useSettings } from "../../context/SettingsContext";
import { RUNWARE_MODEL_PRESETS } from "../../types/settings";

interface SettingsDialogProps {
  onClose: () => void;
}

const CUSTOM_VALUE = "__custom__";

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();
  const [anthropicKey, setAnthropicKey] = useState(settings.anthropicApiKey);
  const [runwareKey, setRunwareKey] = useState(settings.runwareApiKey);
  const [concurrency, setConcurrency] = useState(settings.batchConcurrency);
  const [removeBg, setRemoveBg] = useState(settings.removeBackground);

  const isPreset = RUNWARE_MODEL_PRESETS.some((p) => p.id === settings.runwareModel);
  const [modelSelect, setModelSelect] = useState(isPreset ? settings.runwareModel : CUSTOM_VALUE);
  const [customModel, setCustomModel] = useState(isPreset ? "" : settings.runwareModel);

  const resolvedModel = modelSelect === CUSTOM_VALUE ? customModel : modelSelect;

  const handleSave = () => {
    updateSettings({
      anthropicApiKey: anthropicKey,
      runwareApiKey: runwareKey,
      runwareModel: resolvedModel || "runware:101@1",
      batchConcurrency: concurrency,
      removeBackground: removeBg,
    });
    onClose();
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Settings</h2>

        <div className="dialog-field">
          <label className="dialog-label">Anthropic API Key</label>
          <input
            className="dialog-input"
            type="password"
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            placeholder="sk-ant-..."
          />
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Runware API Key</label>
          <input
            className="dialog-input"
            type="password"
            value={runwareKey}
            onChange={(e) => setRunwareKey(e.target.value)}
            placeholder="Enter Runware API key..."
          />
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Image Model</label>
          <select
            className="dialog-input"
            value={modelSelect}
            onChange={(e) => setModelSelect(e.target.value)}
          >
            {RUNWARE_MODEL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.cost})
              </option>
            ))}
            <option value={CUSTOM_VALUE}>Custom model ID...</option>
          </select>
          {modelSelect === CUSTOM_VALUE && (
            <input
              className="dialog-input"
              style={{ marginTop: 6 }}
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="e.g. civitai:102438@133677"
            />
          )}
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Batch Concurrency</label>
          <div className="slider-field">
            <input
              className="slider-input"
              type="range"
              min={1}
              max={30}
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
            />
            <span className="slider-value">{concurrency}</span>
          </div>
        </div>

        <div className="dialog-field">
          <label className="checkbox-field">
            <input
              className="checkbox-input"
              type="checkbox"
              checked={removeBg}
              onChange={(e) => setRemoveBg(e.target.checked)}
            />
            Remove background (mobs & items)
          </label>
          <div style={{ fontSize: "0.78rem", color: "var(--text-disabled)", marginTop: 4 }}>
            Produces transparent PNGs via Runware background removal. Adds ~$0.004/image.
          </div>
        </div>

        <div className="dialog-actions">
          <button className="soft-button" onClick={onClose}>
            Cancel
          </button>
          <button className="soft-button soft-button--primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
