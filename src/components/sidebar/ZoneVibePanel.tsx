import { useCallback, useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { generateZoneVibe, generateDefaultImagePrompt } from "../../lib/prompt-gen";
import { generateImage, getAspectRatio, bytesToBase64 } from "../../lib/image-gen";
import { runwareEnhancePrompt } from "../../lib/runware-llm";
import type { LlmCallOptions } from "../../lib/llm";
import type { DefaultImageEntry, DefaultImageEntityType } from "../../types/project";

const DEFAULT_TYPES: DefaultImageEntityType[] = ["room", "mob", "item"];

interface ZoneVibePanelProps {
  zoneName: string;
  vibe: string | null;
  defaultImages: Record<DefaultImageEntityType, DefaultImageEntry> | null;
  allRoomDescriptions: string[];
}

export function ZoneVibePanel({ zoneName, vibe, defaultImages, allRoomDescriptions }: ZoneVibePanelProps) {
  const { updateVibe, updateDefaultImage, getDefaultImageDataUrl } = useProject();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(vibe || "");
  const [error, setError] = useState<string | null>(null);

  // Per-type generation status
  const [generatingDefaults, setGeneratingDefaults] = useState<Record<DefaultImageEntityType, boolean>>({
    room: false, mob: false, item: false,
  });
  const [defaultThumbnails, setDefaultThumbnails] = useState<Record<DefaultImageEntityType, string | null>>({
    room: null, mob: null, item: null,
  });
  const [defaultError, setDefaultError] = useState<string | null>(null);

  // Load existing default image thumbnails
  useEffect(() => {
    if (!defaultImages) return;
    for (const entityType of DEFAULT_TYPES) {
      if (defaultImages[entityType]?.filename) {
        getDefaultImageDataUrl(zoneName, entityType).then((url) => {
          if (url) {
            setDefaultThumbnails((prev) => ({ ...prev, [entityType]: url }));
          }
        });
      }
    }
  }, [defaultImages, zoneName, getDefaultImageDataUrl]);

  const getLlmOpts = useCallback((): LlmCallOptions => ({
    provider: settings.promptLlm,
    anthropicApiKey: settings.anthropicApiKey,
    runwareApiKey: settings.runwareApiKey,
    runwareLlmModel: settings.runwareLlmModel,
    openRouterApiKey: settings.openRouterApiKey,
    openRouterModel: settings.openRouterModel,
  }), [settings.promptLlm, settings.anthropicApiKey, settings.runwareApiKey, settings.runwareLlmModel, settings.openRouterApiKey, settings.openRouterModel]);

  const generateOneDefault = useCallback(
    async (entityType: DefaultImageEntityType, vibeText: string) => {
      if (!settings.runwareApiKey) return;

      setGeneratingDefaults((prev) => ({ ...prev, [entityType]: true }));
      try {
        let prompt = await generateDefaultImagePrompt(
          getLlmOpts(),
          entityType,
          zoneName,
          vibeText
        );

        if (settings.enhancePrompts && settings.runwareApiKey) {
          prompt = await runwareEnhancePrompt(settings.runwareApiKey, prompt);
        }

        const result = await generateImage(settings.runwareApiKey, prompt, {
          aspectRatio: getAspectRatio(entityType),
          entityType,
          removeBackground: settings.removeBackground,
        }, settings.runwareModel);

        await updateDefaultImage(zoneName, entityType, result.bytes, prompt);

        // Update thumbnail from the raw bytes
        const dataUrl = `data:image/png;base64,${bytesToBase64(result.bytes)}`;
        setDefaultThumbnails((prev) => ({ ...prev, [entityType]: dataUrl }));
      } catch (err) {
        setDefaultError(
          `Failed to generate default ${entityType}: ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        setGeneratingDefaults((prev) => ({ ...prev, [entityType]: false }));
      }
    },
    [settings.runwareApiKey, settings.enhancePrompts, zoneName, updateDefaultImage, getLlmOpts]
  );

  const generateAllDefaults = useCallback(
    async (vibeText: string) => {
      if (!settings.runwareApiKey) {
        setDefaultError("API keys not set — open Settings (Ctrl+,) to add them.");
        return;
      }
      setDefaultError(null);
      await Promise.all(DEFAULT_TYPES.map((t) => generateOneDefault(t, vibeText)));
    },
    [settings.runwareApiKey, generateOneDefault]
  );

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const newVibe = await generateZoneVibe(
        getLlmOpts(),
        zoneName,
        allRoomDescriptions
      );
      await updateVibe(zoneName, newVibe);
      setEditText(newVibe);

      // Auto-generate default images after vibe
      generateAllDefaults(newVibe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate vibe");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    await updateVibe(zoneName, editText);
    setEditing(false);
  };

  const anyGenerating = DEFAULT_TYPES.some((t) => generatingDefaults[t]);

  return (
    <div className="glass-panel">
      <div className="glass-panel-header">
        <span className="glass-panel-title">Zone Vibe</span>
        <div className="zone-vibe-actions">
          {vibe && !editing && (
            <button
              className="soft-button soft-button--small"
              onClick={() => { setEditText(vibe); setEditing(true); }}
            >
              Edit
            </button>
          )}
          <button
            className="soft-button soft-button--small soft-button--primary"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading && <span className="spinner spinner--small" />}
            {vibe ? "Regenerate" : "Generate Vibe"}
          </button>
        </div>
      </div>

      {error && (
        <div className="zone-vibe-error">{error}</div>
      )}

      {editing ? (
        <div>
          <textarea
            className="zone-vibe-textarea"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
          <div className="zone-vibe-actions">
            <button className="soft-button soft-button--small soft-button--success" onClick={handleSave}>
              Save
            </button>
            <button className="soft-button soft-button--small" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : vibe ? (
        <p className="zone-vibe-text">{vibe}</p>
      ) : (
        <p className="zone-vibe-text zone-vibe-text--empty">
          No vibe generated yet. Click "Generate Vibe" to create one.
        </p>
      )}

      {/* Default images section — shown when vibe exists */}
      {vibe && (
        <div className="zone-defaults">
          <div className="zone-defaults-header">
            <span className="zone-defaults-label">Default Images</span>
            <button
              className="soft-button soft-button--small"
              onClick={() => generateAllDefaults(vibe)}
              disabled={anyGenerating}
            >
              {anyGenerating && <span className="spinner spinner--small" />}
              {defaultImages ? "Regenerate Defaults" : "Generate Defaults"}
            </button>
          </div>

          {defaultError && (
            <div className="zone-vibe-error">{defaultError}</div>
          )}

          <div className="zone-defaults-row">
            {DEFAULT_TYPES.map((entityType) => (
              <div
                key={entityType}
                className={`zone-default-card ${entityType === "room" ? "zone-default-card--room" : "zone-default-card--square"}`}
              >
                <div
                  className={`zone-default-thumb ${entityType === "room" ? "zone-default-thumb--landscape" : "zone-default-thumb--square"}`}
                >
                  {generatingDefaults[entityType] ? (
                    <span className="spinner spinner--small" />
                  ) : defaultThumbnails[entityType] ? (
                    <img
                      src={defaultThumbnails[entityType]!}
                      alt={`Default ${entityType}`}
                    />
                  ) : (
                    <span className="zone-default-thumb-placeholder">--</span>
                  )}
                </div>
                <div className="zone-default-label">
                  {entityType}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
