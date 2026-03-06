import { useCallback, useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { useGeneration } from "../../context/GenerationContext";
import { removeImageBackground, flipImageHorizontally } from "../../lib/image-gen";
import { ImagePreview } from "./ImagePreview";
import { PromptEditor } from "./PromptEditor";
import { ActionBar } from "./ActionBar";
import { VariantStrip } from "./VariantStrip";
import { SpriteGrid } from "../sprites/SpriteGrid";
import { EntityFieldEditor } from "./EntityFieldEditor";

export function DetailPanel() {
  const {
    project,
    parsedZones,
    selectedEntityId,
    selectedZone,
    getEntity,
    getAsset,
    updatePrompt,
    approveVariant,
    getImageDataUrl,
    replaceVariantImage,
    getVariantImageBytes,
    viewingVariantIndex,
    setViewingVariant,
  } = useProject();
  const { settings } = useSettings();
  const {
    startPromptGeneration,
    startCustomPromptGeneration,
    startImageGeneration,
    startCustomImageGeneration,
    startMultiImageGeneration,
    getJob,
    getError,
    clearError,
  } = useGeneration();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [removingBg, setRemovingBg] = useState(false);
  const [flipping, setFlipping] = useState(false);

  const asset =
    selectedZone && selectedEntityId
      ? getAsset(selectedZone, selectedEntityId)
      : undefined;

  const isCustom = !!asset?.customDescription;

  // For custom assets, synthesize an Entity from AssetEntry data
  const parsedEntity = selectedEntityId ? getEntity(selectedEntityId) : undefined;
  const entity = parsedEntity ?? (isCustom && asset ? {
    id: asset.entityId,
    type: asset.entityType,
    title: asset.title,
    description: asset.customDescription!,
    extraContext: "",
    bareId: asset.entityId,
    rawYaml: {},
  } : undefined);

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
    if (!settings.anthropicApiKey) {
      setLocalError("Anthropic API key not set. Open Settings.");
      return;
    }

    if (isCustom) {
      // Custom assets can optionally use zone vibe but don't require it
      setLocalError(null);
      if (selectedZone && selectedEntityId) clearError(selectedZone, selectedEntityId);
      startCustomPromptGeneration(
        selectedZone,
        entity.id,
        asset!.customDescription!,
        entity.type,
        zone?.vibe ?? null
      );
    } else {
      if (!zone?.vibe) {
        setLocalError("Generate a zone vibe first before generating prompts.");
        return;
      }
      setLocalError(null);
      if (selectedZone && selectedEntityId) clearError(selectedZone, selectedEntityId);
      startPromptGeneration(selectedZone, entity.id, entity, zone.vibe);
    }
  };

  const handleGenerateImage = () => {
    if (!entity || !selectedZone || !asset?.currentPrompt) return;
    if (!settings.runwareApiKey) {
      setLocalError("Runware API key not set. Open Settings.");
      return;
    }

    setLocalError(null);
    if (selectedZone && selectedEntityId) clearError(selectedZone, selectedEntityId);
    if (isCustom) {
      startCustomImageGeneration(selectedZone, entity.id, asset.currentPrompt, entity.type);
    } else {
      startImageGeneration(selectedZone, entity.id, asset.currentPrompt, entity);
    }
  };

  const handleGenerateMultiImage = () => {
    if (!entity || !selectedZone || !asset?.currentPrompt) return;
    if (!settings.runwareApiKey) {
      setLocalError("Runware API key not set. Open Settings.");
      return;
    }

    setLocalError(null);
    if (selectedZone && selectedEntityId) clearError(selectedZone, selectedEntityId);
    startMultiImageGeneration(selectedZone, entity.id, asset.currentPrompt, entity, 4);
  };

  const handleApprove = async () => {
    if (!selectedZone || !selectedEntityId) return;
    await approveVariant(selectedZone, selectedEntityId, viewingVariantIndex);
  };

  const handleRemoveBackground = async () => {
    if (!selectedZone || !selectedEntityId || !currentVariant) return;
    if (!settings.runwareApiKey) {
      setLocalError("Runware API key not set. Open Settings.");
      return;
    }

    setLocalError(null);
    setRemovingBg(true);
    try {
      const bytes = await getVariantImageBytes(selectedZone, selectedEntityId, currentVariant.filename);
      const processed = await removeImageBackground(settings.runwareApiKey, bytes, entity?.type);
      await replaceVariantImage(selectedZone, selectedEntityId, viewingVariantIndex, processed);
      // Force image refresh
      setImageSrc(null);
      const dataUrl = await getImageDataUrl(selectedZone, selectedEntityId, currentVariant.filename);
      setImageSrc(dataUrl);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to remove background");
    } finally {
      setRemovingBg(false);
    }
  };

  const handleFlipHorizontal = async () => {
    if (!selectedZone || !selectedEntityId || !currentVariant) return;
    setFlipping(true);
    try {
      const bytes = await getVariantImageBytes(selectedZone, selectedEntityId, currentVariant.filename);
      const flipped = await flipImageHorizontally(bytes, currentVariant.filename);
      await replaceVariantImage(selectedZone, selectedEntityId, viewingVariantIndex, flipped);
      setImageSrc(null);
      const dataUrl = await getImageDataUrl(selectedZone, selectedEntityId, currentVariant.filename);
      setImageSrc(dataUrl);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to flip image");
    } finally {
      setFlipping(false);
    }
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

  // If selected zone is a sprite zone, show SpriteGrid
  if (selectedZone && project?.zones[selectedZone]?.spriteConfig && parsedZones[selectedZone]) {
    const zone = project.zones[selectedZone];
    return (
      <SpriteGrid
        zoneKey={selectedZone}
        zone={zone}
        entities={parsedZones[selectedZone].entities}
        spriteConfig={zone.spriteConfig!}
      />
    );
  }

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
            {isCustom ? `custom ${entity.type}` : entity.type}
          </span>
        </div>
        {isCustom ? (
          <div className="detail-description">{entity.description}</div>
        ) : selectedZone ? (
          <EntityFieldEditor
            entity={entity}
            zoneKey={selectedZone}
          />
        ) : null}
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
          imageJobProgress={job?.total ? { total: job.total, completed: job.completed ?? 0 } : undefined}
          isRemovingBg={removingBg}
          isFlipping={flipping}
          entityType={entity.type}
          onGeneratePrompt={handleGeneratePrompt}
          onGenerateImage={handleGenerateImage}
          onGenerateMultiImage={handleGenerateMultiImage}
          onApprove={handleApprove}
          onRemoveBackground={handleRemoveBackground}
          onFlipHorizontal={handleFlipHorizontal}
        />
      </div>
    </div>
  );
}
