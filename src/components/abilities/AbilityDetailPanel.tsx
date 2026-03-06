import { useCallback, useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { useGeneration } from "../../context/GenerationContext";
import { removeImageBackground, flipImageHorizontally } from "../../lib/image-gen";
import { ImagePreview } from "../detail/ImagePreview";
import { PromptEditor } from "../detail/PromptEditor";
import { ActionBar } from "../detail/ActionBar";
import { VariantStrip } from "../detail/VariantStrip";
import type { AbilityDefinition } from "../../types/abilities";

interface AbilityDetailPanelProps {
  zoneKey: string;
  entityId: string;
  onBack: () => void;
}

export function AbilityDetailPanel({
  zoneKey,
  entityId,
  onBack,
}: AbilityDetailPanelProps) {
  const {
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
    startImageGeneration,
    startMultiImageGeneration,
    getJob,
    getError,
    clearError,
  } = useGeneration();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [removingBg, setRemovingBg] = useState(false);
  const [flipping, setFlipping] = useState(false);

  const entity = getEntity(entityId);
  const asset = getAsset(zoneKey, entityId);
  const currentVariant = asset?.variants[viewingVariantIndex];
  const job = getJob(zoneKey, entityId);
  const genError = getError(zoneKey, entityId);
  const generatingPrompt = job?.type === "prompt";
  const generatingImage = job?.type === "image";
  const error = localError || genError || null;

  const ability = entity?.rawYaml as unknown as AbilityDefinition | undefined;

  useEffect(() => {
    if (currentVariant) {
      getImageDataUrl(zoneKey, entityId, currentVariant.filename)
        .then(setImageSrc)
        .catch(() => setImageSrc(null));
    } else {
      setImageSrc(null);
    }
  }, [zoneKey, entityId, currentVariant, getImageDataUrl]);

  useEffect(() => {
    setLocalError(null);
  }, [zoneKey, entityId]);

  const handleGeneratePrompt = () => {
    if (!entity) return;
    if (!settings.anthropicApiKey) {
      setLocalError("Anthropic API key not set. Open Settings.");
      return;
    }
    setLocalError(null);
    clearError(zoneKey, entityId);
    // Ability prompts don't need zone vibe — the generation context
    // detects entity.type === "ability" and uses the ability prompt generator
    startPromptGeneration(zoneKey, entityId, entity, "");
  };

  const handleGenerateImage = () => {
    if (!entity || !asset?.currentPrompt) return;
    if (!settings.runwareApiKey) {
      setLocalError("Runware API key not set. Open Settings.");
      return;
    }
    setLocalError(null);
    clearError(zoneKey, entityId);
    startImageGeneration(zoneKey, entityId, asset.currentPrompt, entity);
  };

  const handleGenerateMultiImage = () => {
    if (!entity || !asset?.currentPrompt) return;
    if (!settings.runwareApiKey) {
      setLocalError("Runware API key not set. Open Settings.");
      return;
    }
    setLocalError(null);
    clearError(zoneKey, entityId);
    startMultiImageGeneration(zoneKey, entityId, asset.currentPrompt, entity, 4);
  };

  const handleApprove = async () => {
    await approveVariant(zoneKey, entityId, viewingVariantIndex);
  };

  const handleRemoveBackground = async () => {
    if (!currentVariant) return;
    if (!settings.runwareApiKey) {
      setLocalError("Runware API key not set. Open Settings.");
      return;
    }
    setLocalError(null);
    setRemovingBg(true);
    try {
      const bytes = await getVariantImageBytes(zoneKey, entityId, currentVariant.filename);
      const processed = await removeImageBackground(settings.runwareApiKey, bytes, "ability");
      await replaceVariantImage(zoneKey, entityId, viewingVariantIndex, processed);
      setImageSrc(null);
      const dataUrl = await getImageDataUrl(zoneKey, entityId, currentVariant.filename);
      setImageSrc(dataUrl);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to remove background");
    } finally {
      setRemovingBg(false);
    }
  };

  const handleFlipHorizontal = async () => {
    if (!currentVariant) return;
    setFlipping(true);
    try {
      const bytes = await getVariantImageBytes(zoneKey, entityId, currentVariant.filename);
      const flipped = await flipImageHorizontally(bytes, currentVariant.filename);
      await replaceVariantImage(zoneKey, entityId, viewingVariantIndex, flipped);
      setImageSrc(null);
      const dataUrl = await getImageDataUrl(zoneKey, entityId, currentVariant.filename);
      setImageSrc(dataUrl);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to flip image");
    } finally {
      setFlipping(false);
    }
  };

  const handlePromptChange = async (prompt: string) => {
    await updatePrompt(zoneKey, entityId, prompt);
  };

  const getVariantDataUrl = useCallback(
    async (filename: string) => {
      return getImageDataUrl(zoneKey, entityId, filename);
    },
    [zoneKey, entityId, getImageDataUrl]
  );

  if (!entity || !asset) return null;

  const isApproved =
    asset.status === "approved" && asset.approvedVariantIndex === viewingVariantIndex;

  return (
    <div className="sprite-detail-panel">
      <div className="sprite-detail-header">
        <button className="soft-button soft-button--small" onClick={onBack}>
          Back to Grid
        </button>
        <h3 className="sprite-detail-title">{entity.title}</h3>
        {ability && (
          <span className="ability-detail-meta">
            {ability.requiredClass} &middot; Lv {ability.levelRequired} &middot; {ability.effect.type.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {ability && (
        <div className="ability-detail-description">
          {ability.description}
        </div>
      )}

      {error && (
        <div className="sprite-detail-error">{error}</div>
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
