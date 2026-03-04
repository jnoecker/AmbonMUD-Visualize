import { useState } from "react";
import { useSettings } from "../../context/SettingsContext";

interface SettingsDialogProps {
  onClose: () => void;
}

export function SettingsDialog({ onClose }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();
  const [anthropicKey, setAnthropicKey] = useState(settings.anthropicApiKey);
  const [openaiKey, setOpenaiKey] = useState(settings.openaiApiKey);
  const [concurrency, setConcurrency] = useState(settings.batchConcurrency);

  const handleSave = () => {
    updateSettings({
      anthropicApiKey: anthropicKey,
      openaiApiKey: openaiKey,
      batchConcurrency: concurrency,
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
          <label className="dialog-label">OpenAI API Key</label>
          <input
            className="dialog-input"
            type="password"
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            placeholder="sk-..."
          />
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Batch Concurrency</label>
          <div className="slider-field">
            <input
              className="slider-input"
              type="range"
              min={1}
              max={10}
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
            />
            <span className="slider-value">{concurrency}</span>
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
