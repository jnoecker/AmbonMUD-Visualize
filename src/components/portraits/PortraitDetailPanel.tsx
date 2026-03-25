import { useCallback, useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { useGeneration } from "../../context/GenerationContext";
import { flipImageHorizontally } from "../../lib/image-gen";
import { ImagePreview } from "../detail/ImagePreview";
import { PromptEditor } from "../detail/PromptEditor";
import { VariantStrip } from "../detail/VariantStrip";
import { fillPortraitTemplate } from "../../lib/portrait-prompt-gen";
import { parsePortraitId } from "../../lib/portrait-parser";
import { generateImage } from "../../lib/image-gen";
import type { PortraitPromptTemplate } from "../../types/portraits";

interface PortraitDetailPanelProps {
  zoneKey: string;
  entityId: string;
  portraitTemplate: PortraitPromptTemplate | null;
  onBack: () => void;
}

/** FLUX 2 for portraits — same price as Schnell, good quality. */
const PORTRAIT_MODEL = "runware:400@2";

export function PortraitDetailPanel({
  zoneKey,
  entityId,
  portraitTemplate,
  onBack,
}: PortraitDetailPanelProps) {
  const {
    getEntity,
    getAsset,
    updatePrompt,
    approveVariant,
    addVariant,
    getImageDataUrl,
    replaceVariantImage,
    getVariantImageBytes,
    viewingVariantIndex,
    setViewingVariant,
  } = useProject();
  const { settings } = useSettings();
  const { getJob, getError, clearError } = useGeneration();

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [flipping, setFlipping] = useState(false);

  const entity = getEntity(entityId);
  const asset = getAsset(zoneKey, entityId);
  const currentVariant = asset?.variants[viewingVariantIndex];
  const job = getJob(zoneKey, entityId);
  const genError = getError(zoneKey, entityId);
  const generatingPrompt = job?.type === "prompt";
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
    if (portraitTemplate) {
      const dims = parsePortraitId(entityId);
      if (dims) {
        const prompt = fillPortraitTemplate(portraitTemplate, dims);
        await updatePrompt(zoneKey, entityId, prompt);
        return;
      }
    }
    setLocalError("Generate a prompt template first — use \"Generate Template\" at the top of this view.");
  };

  const handleGenerateImage = async () => {
    if (!entity || !asset?.currentPrompt) return;
    if (!settings.runwareApiKey) {
      setLocalError("Runware API key not set — open Settings (Ctrl+,) to add it.");
      return;
    }
    setLocalError(null);
    clearError(zoneKey, entityId);
    setGeneratingImage(true);
    try {
      const result = await generateImage(
        settings.runwareApiKey,
        asset.currentPrompt,
        {
          aspectRatio: "2:3",
          entityType: entity.type,
          removeBackground: false,
        },
        PORTRAIT_MODEL
      );
      const newIndex = await addVariant(zoneKey, entityId, result.bytes, asset.currentPrompt);
      if (newIndex !== undefined) {
        setViewingVariant(newIndex);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleApprove = async () => {
    await approveVariant(zoneKey, entityId, viewingVariantIndex);
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
      </div>

      {error && (
        <div className="sprite-detail-error">{error}</div>
      )}

      <div className="glass-panel">
        <ImagePreview
          src={imageSrc}
          entityType="room"
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
        <div className="action-bar">
          <button
            className="soft-button"
            onClick={handleGeneratePrompt}
            disabled={generatingPrompt || !portraitTemplate}
            title={!portraitTemplate ? "Generate template first" : undefined}
          >
            {asset.currentPrompt ? "Regenerate Prompt" : "Generate Prompt"}
          </button>
          <button
            className="soft-button"
            onClick={handleGenerateImage}
            disabled={!asset.currentPrompt || generatingImage}
          >
            {asset.variants.length > 0 ? "Generate Another" : "Generate Image"}
          </button>
          {currentVariant && (
            <button
              className="soft-button soft-button--small"
              onClick={handleFlipHorizontal}
              disabled={flipping}
            >
              {flipping ? "Flipping..." : "Flip"}
            </button>
          )}
          {currentVariant && !isApproved && (
            <button
              className="soft-button soft-button--approve"
              onClick={handleApprove}
            >
              Approve
            </button>
          )}
          {isApproved && (
            <span className="action-bar-approved">Approved</span>
          )}
        </div>
      </div>
    </div>
  );
}
