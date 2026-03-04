import { useCallback, useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { useGeneration } from "../../context/GenerationContext";
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
    approveVariant,
    getImageDataUrl,
    viewingVariantIndex,
    setViewingVariant,
  } = useProject();
  const { settings } = useSettings();
  const { startPromptGeneration, startImageGeneration, getJob, getError, clearError } =
    useGeneration();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const entity = selectedEntityId ? getEntity(selectedEntityId) : undefined;
  const asset =
    selectedZone && selectedEntityId
      ? getAsset(selectedZone, selectedEntityId)
      : undefined;

  const currentVariant = asset?.variants[viewingVariantIndex];

  const job = selectedZone && selectedEntityId ? getJob(selectedZone, selectedEntityId) : undefined;
  const genError =
    selectedZone && selectedEntityId ? getError(selectedZone, selectedEntityId) : undefined;
  const generatingPrompt = job?.type === "prompt";
  const generatingImage = job?.type === "image";

  const error = localError || genError || null;

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

  // Clear local error and generation error when switching entities
  useEffect(() => {
    setLocalError(null);
  }, [selectedZone, selectedEntityId]);

  const handleGeneratePrompt = () => {
    if (!entity || !selectedZone || !project) return;
    const zone = project.zones[selectedZone];
    if (!zone?.vibe) {
      setLocalError("Generate a zone vibe first before generating prompts.");
      return;
    }
    if (!settings.anthropicApiKey) {
      setLocalError("Anthropic API key not set. Open Settings.");
      return;
    }

    setLocalError(null);
    if (selectedZone && selectedEntityId) clearError(selectedZone, selectedEntityId);
    startPromptGeneration(selectedZone, entity.id, entity, zone.vibe);
  };

  const handleGenerateImage = () => {
    if (!entity || !selectedZone || !asset?.currentPrompt) return;
    if (!settings.openaiApiKey) {
      setLocalError("OpenAI API key not set. Open Settings.");
      return;
    }

    setLocalError(null);
    if (selectedZone && selectedEntityId) clearError(selectedZone, selectedEntityId);
    startImageGeneration(selectedZone, entity.id, asset.currentPrompt, entity);
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
