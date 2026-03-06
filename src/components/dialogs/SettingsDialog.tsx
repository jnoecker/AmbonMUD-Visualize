import { useState } from "react";
import { useSettings } from "../../context/SettingsContext";
import { RUNWARE_MODEL_PRESETS, VIDEO_MODEL_PRESETS } from "../../types/settings";

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
  const [promptLlm, setPromptLlm] = useState(settings.promptLlm);
  const [runwareLlmModel, setRunwareLlmModel] = useState(settings.runwareLlmModel);
  const [enhancePrompts, setEnhancePrompts] = useState(settings.enhancePrompts);
  const [videoModel, setVideoModel] = useState(settings.videoModel);

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
      promptLlm,
      runwareLlmModel,
      enhancePrompts,
      videoModel,
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
          <label className="dialog-label">Video Model</label>
          <select
            className="dialog-input"
            value={videoModel}
            onChange={(e) => setVideoModel(e.target.value)}
          >
            {VIDEO_MODEL_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} ({p.cost})
              </option>
            ))}
          </select>
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Prompt LLM Provider</label>
          <select
            className="dialog-input"
            value={promptLlm}
            onChange={(e) => setPromptLlm(e.target.value as "claude" | "runware")}
          >
            <option value="claude">Claude (Anthropic)</option>
            <option value="runware">Runware Text Inference</option>
          </select>
          <div style={{ fontSize: "0.78rem", color: "var(--text-disabled)", marginTop: 4 }}>
            Which LLM generates image/music prompts. Claude is higher quality; Runware is cheaper.
          </div>
        </div>

        {promptLlm === "runware" && (
          <div className="dialog-field">
            <label className="dialog-label">Runware LLM Model ID</label>
            <input
              className="dialog-input"
              value={runwareLlmModel}
              onChange={(e) => setRunwareLlmModel(e.target.value)}
              placeholder="e.g. openai:gpt-4o-mini"
            />
            <div style={{ fontSize: "0.78rem", color: "var(--text-disabled)", marginTop: 4 }}>
              A text-only instruct model ID from Runware's model catalog.
            </div>
          </div>
        )}

        <div className="dialog-field">
          <label className="checkbox-field">
            <input
              className="checkbox-input"
              type="checkbox"
              checked={enhancePrompts}
              onChange={(e) => setEnhancePrompts(e.target.checked)}
            />
            Enhance image prompts (Runware Prompt Enhancer)
          </label>
          <div style={{ fontSize: "0.78rem", color: "var(--text-disabled)", marginTop: 4 }}>
            Post-processes LLM-generated image prompts through Runware's free Prompt Enhancer (Llama 3.1 8B).
          </div>
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
