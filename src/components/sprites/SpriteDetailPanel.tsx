import { useCallback, useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { useGeneration } from "../../context/GenerationContext";
import { ImagePreview } from "../detail/ImagePreview";
import { PromptEditor } from "../detail/PromptEditor";
import { ActionBar } from "../detail/ActionBar";
import { VariantStrip } from "../detail/VariantStrip";
import { fillSpriteTemplate } from "../../lib/sprite-prompt-gen";
import { parseSpriteId } from "../../lib/sprite-parser";
import type { SpritePromptTemplate } from "../../types/sprites";

interface SpriteDetailPanelProps {
  zoneKey: string;
  entityId: string;
  spriteTemplate: SpritePromptTemplate | null;
  onBack: () => void;
}

export function SpriteDetailPanel({
  zoneKey,
  entityId,
  spriteTemplate,
  onBack,
}: SpriteDetailPanelProps) {
  const {
    getEntity,
    getAsset,
    updatePrompt,
    approveVariant,
    getImageDataUrl,
    viewingVariantIndex,
    setViewingVariant,
  } = useProject();
  const { settings } = useSettings();
  const { startImageGeneration, getJob, getError, clearError } =
    useGeneration();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const entity = getEntity(entityId);
  const asset = getAsset(zoneKey, entityId);
  const currentVariant = asset?.variants[viewingVariantIndex];
  const job = getJob(zoneKey, entityId);
  const genError = getError(zoneKey, entityId);
  const generatingPrompt = job?.type === "prompt";
  const generatingImage = job?.type === "image";
  const error = localError || genError || null;

  // Load image
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

  const handleGeneratePrompt = async () => {
    if (!entity) return;

    if (spriteTemplate) {
      // Use template fill (no Claude call) for sprites
      const dims = parseSpriteId(entityId);
      if (dims) {
        const prompt = fillSpriteTemplate(spriteTemplate, dims, entity.title);
        await updatePrompt(zoneKey, entityId, prompt);
        return;
      }
    }

    // No template yet — need to generate one first
    setLocalError("Generate a prompt template first using the batch bar.");
  };

  const handleGenerateImage = () => {
    if (!entity || !asset?.currentPrompt) return;
    if (!settings.openaiApiKey) {
      setLocalError("OpenAI API key not set. Open Settings.");
      return;
    }
    setLocalError(null);
    clearError(zoneKey, entityId);
    startImageGeneration(zoneKey, entityId, asset.currentPrompt, entity);
  };

  const handleApprove = async () => {
    await approveVariant(zoneKey, entityId, viewingVariantIndex);
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
      </div>

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
          onGeneratePrompt={handleGeneratePrompt}
          onGenerateImage={handleGenerateImage}
          onApprove={handleApprove}
        />
      </div>
    </div>
  );
}
