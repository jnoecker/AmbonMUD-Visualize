import { useCallback, useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { generateEntityPrompt } from "../../lib/prompt-gen";
import { generateImage, getAspectRatio, ContentPolicyError } from "../../lib/image-gen";
import { ImagePreview } from "./ImagePreview";
import { PromptEditor } from "./PromptEditor";
import { ActionBar } from "./ActionBar";
import { VariantStrip } from "./VariantStrip";

export function DetailPanel() {
  const {
    project,
    selectedEntityId,
    selectedZone,
    getEntity,
    getAsset,
    updatePrompt,
    addVariant,
    approveVariant,
    getImageDataUrl,
    viewingVariantIndex,
    setViewingVariant,
  } = useProject();
  const { settings } = useSettings();

  const [generatingPrompt, setGeneratingPrompt] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const entity = selectedEntityId ? getEntity(selectedEntityId) : undefined;
  const asset =
    selectedZone && selectedEntityId
      ? getAsset(selectedZone, selectedEntityId)
      : undefined;

  const currentVariant = asset?.variants[viewingVariantIndex];

  // Load image data URL when variant changes
  useEffect(() => {
    if (selectedZone && selectedEntityId && currentVariant) {
      getImageDataUrl(selectedZone, selectedEntityId, currentVariant.filename)
        .then(setImageSrc)
        .catch(() => setImageSrc(null));
    } else {
      setImageSrc(null);
    }
  }, [selectedZone, selectedEntityId, currentVariant, getImageDataUrl]);

  const handleGeneratePrompt = async () => {
    if (!entity || !selectedZone || !project) return;
    const zone = project.zones[selectedZone];
    if (!zone?.vibe) {
      setError("Generate a zone vibe first before generating prompts.");
      return;
    }
    if (!settings.anthropicApiKey) {
      setError("Anthropic API key not set. Open Settings.");
      return;
    }

    setGeneratingPrompt(true);
    setError(null);
    try {
      const prompt = await generateEntityPrompt(
        settings.anthropicApiKey,
        entity,
        zone.vibe
      );
      await updatePrompt(selectedZone, entity.id, prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate prompt");
    } finally {
      setGeneratingPrompt(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!entity || !selectedZone || !asset?.currentPrompt) return;
    if (!settings.openaiApiKey) {
      setError("OpenAI API key not set. Open Settings.");
      return;
    }

    setGeneratingImage(true);
    setError(null);
    try {
      const imageData = await generateImage(settings.openaiApiKey, asset.currentPrompt, {
        aspectRatio: getAspectRatio(entity.type),
        entityType: entity.type,
      });
      await addVariant(selectedZone, entity.id, imageData, asset.currentPrompt);
    } catch (err) {
      if (err instanceof ContentPolicyError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate image");
      }
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedZone || !selectedEntityId) return;
    await approveVariant(selectedZone, selectedEntityId, viewingVariantIndex);
  };

  const handlePromptChange = async (prompt: string) => {
    if (!selectedZone || !selectedEntityId) return;
    await updatePrompt(selectedZone, selectedEntityId, prompt);
  };

  const getVariantDataUrl = useCallback(
    async (filename: string) => {
      if (!selectedZone || !selectedEntityId) throw new Error("No entity selected");
      return getImageDataUrl(selectedZone, selectedEntityId, filename);
    },
    [selectedZone, selectedEntityId, getImageDataUrl]
  );

  if (!entity || !asset) {
    return (
      <div className="detail-panel" style={{ alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-disabled)" }}>Select an entity from the sidebar</p>
      </div>
    );
  }

  const isApproved =
    asset.status === "approved" && asset.approvedVariantIndex === viewingVariantIndex;

  return (
    <div className="detail-panel">
      <div className="glass-panel">
        <div className="detail-entity-header">
          <h2 className="detail-entity-title">{entity.title}</h2>
          <span className={`entity-type-badge entity-type-badge--${entity.type}`}>
            {entity.type}
          </span>
        </div>
        <div className="detail-description">{entity.description}</div>
        {entity.extraContext && (
          <pre
            style={{
              fontSize: "0.78rem",
              color: "var(--text-disabled)",
              fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
            }}
          >
            {entity.extraContext}
          </pre>
        )}
      </div>

      {error && (
        <div
          style={{
            color: "var(--color-error)",
            fontSize: "0.85rem",
            padding: "var(--space-2) var(--space-3)",
            background: "rgb(197 168 168 / 10%)",
            borderRadius: "var(--radius-md)",
          }}
        >
          {error}
        </div>
      )}

      <div className="glass-panel">
        <ImagePreview
          src={imageSrc}
          entityType={entity.type}
          loading={generatingImage}
        />

        <VariantStrip
          variants={asset.variants}
          selectedIndex={viewingVariantIndex}
          approvedIndex={asset.approvedVariantIndex}
          onSelect={setViewingVariant}
          getDataUrl={getVariantDataUrl}
        />
      </div>

      <div className="glass-panel">
        <PromptEditor
          prompt={asset.currentPrompt || ""}
          onChange={handlePromptChange}
          disabled={generatingPrompt}
        />

        <ActionBar
          hasPrompt={!!asset.currentPrompt}
          hasVariants={asset.variants.length > 0}
          isApproved={isApproved}
          isGeneratingPrompt={generatingPrompt}
          isGeneratingImage={generatingImage}
          onGeneratePrompt={handleGeneratePrompt}
          onGenerateImage={handleGenerateImage}
          onApprove={handleApprove}
        />
      </div>
    </div>
  );
}
