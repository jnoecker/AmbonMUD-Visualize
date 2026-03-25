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
import { AbilityGrid } from "../abilities/AbilityGrid";
import { PortraitGrid } from "../portraits/PortraitGrid";
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
      setLocalError("Anthropic API key not set — open Settings (Ctrl+,) to add it.");
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
        setLocalError("Generate a zone vibe first — click \"Generate Vibe\" in the sidebar.");
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
      setLocalError("Runware API key not set — open Settings (Ctrl+,) to add it.");
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
      setLocalError("Runware API key not set — open Settings (Ctrl+,) to add it.");
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
      setLocalError("Runware API key not set — open Settings (Ctrl+,) to add it.");
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

  // If selected zone is a portrait zone, show PortraitGrid
  if (selectedZone && project?.zones[selectedZone]?.portraitConfig && parsedZones[selectedZone]) {
    const zone = project.zones[selectedZone];
    return (
      <PortraitGrid
        zoneKey={selectedZone}
        zone={zone}
        entities={parsedZones[selectedZone].entities}
        portraitConfig={zone.portraitConfig!}
      />
    );
  }

  // If selected zone is an ability zone, show AbilityGrid
  if (selectedZone && project?.zones[selectedZone]?.abilityConfig && parsedZones[selectedZone]) {
    const zone = project.zones[selectedZone];
    return (
      <AbilityGrid
        zoneKey={selectedZone}
        zone={zone}
        entities={parsedZones[selectedZone].entities}
        abilityConfig={zone.abilityConfig!}
      />
    );
  }

  if (!entity || !asset) {
    return <ProjectOverview />;
  }

  const isApproved =
    asset.status === "approved" && asset.approvedVariantIndex === viewingVariantIndex;

  return (
    <div className="detail-panel" key={entity.id}>
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
        <div className="inline-error">{error}</div>
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

/** Contextual project overview shown when no entity is selected. */
function ProjectOverview() {
  const { project, parsedZones } = useProject();
  const { settings } = useSettings();

  if (!project) return null;

  // Compute per-zone stats
  const zoneStats = Object.entries(project.zones).map(([key, zone]) => {
    const parsed = parsedZones[key];
    const entities = parsed?.entities ?? [];
    const assets = Object.values(zone.assets);
    const rooms = entities.filter((e) => e.type === "room").length;
    const mobs = entities.filter((e) => e.type === "mob").length;
    const items = entities.filter((e) => e.type === "item").length;
    const needsPrompt = assets.filter((a) => !a.currentPrompt).length;
    const needsImage = assets.filter((a) => a.currentPrompt && a.variants.length === 0).length;
    const needsApproval = assets.filter((a) => a.variants.length > 0 && a.status !== "approved").length;
    const approved = assets.filter((a) => a.status === "approved").length;
    const total = assets.length;
    return { key, zone, rooms, mobs, items, needsPrompt, needsImage, needsApproval, approved, total, hasVibe: !!zone.vibe };
  });

  // Determine the next recommended action across the whole project
  const missingKeys = !settings.anthropicApiKey || !settings.runwareApiKey;
  const zonesNeedVibe = zoneStats.filter((z) => !z.hasVibe && !z.zone.spriteConfig && !z.zone.abilityConfig && !z.zone.portraitConfig);
  const totalNeedsPrompt = zoneStats.reduce((n, z) => n + z.needsPrompt, 0);
  const totalNeedsImage = zoneStats.reduce((n, z) => n + z.needsImage, 0);
  const totalNeedsApproval = zoneStats.reduce((n, z) => n + z.needsApproval, 0);
  const totalApproved = zoneStats.reduce((n, z) => n + z.approved, 0);
  const totalAssets = zoneStats.reduce((n, z) => n + z.total, 0);

  let nextStep: { label: string; detail: string } | null = null;

  if (missingKeys) {
    nextStep = { label: "Configure API Keys", detail: "Open Settings (Ctrl+,) to add your Anthropic and Runware API keys." };
  } else if (zonesNeedVibe.length > 0) {
    nextStep = { label: "Generate Zone Vibes", detail: `${zonesNeedVibe.length} zone${zonesNeedVibe.length > 1 ? "s need" : " needs"} a vibe summary. Click "Generate Vibe" in the sidebar.` };
  } else if (totalNeedsPrompt > 0) {
    nextStep = { label: "Generate Prompts", detail: `${totalNeedsPrompt} entit${totalNeedsPrompt === 1 ? "y needs a" : "ies need"} prompt. Select entities or use Batch Generate.` };
  } else if (totalNeedsImage > 0) {
    nextStep = { label: "Generate Images", detail: `${totalNeedsImage} entit${totalNeedsImage === 1 ? "y has a" : "ies have"} prompt but no image. Select entities or use Batch Generate.` };
  } else if (totalNeedsApproval > 0) {
    nextStep = { label: "Review & Approve", detail: `${totalNeedsApproval} entit${totalNeedsApproval === 1 ? "y has" : "ies have"} generated images waiting for approval.` };
  } else if (totalApproved > 0) {
    nextStep = { label: "Ready to Export", detail: `All ${totalApproved} approved images are ready. Click Export to write them to your zone files.` };
  }

  return (
    <div className="detail-panel detail-panel--empty">
      <div className="project-overview">
        <h2 className="project-overview-title">{project.name}</h2>

        {/* Pipeline summary */}
        {totalAssets > 0 && (
          <div className="project-overview-pipeline">
            <PipelineStage label="Needs Prompt" count={totalNeedsPrompt} total={totalAssets} color="var(--text-disabled)" />
            <PipelineStage label="Needs Image" count={totalNeedsImage} total={totalAssets} color="var(--color-primary-pale-blue)" />
            <PipelineStage label="Needs Approval" count={totalNeedsApproval} total={totalAssets} color="var(--color-primary-soft-gold)" />
            <PipelineStage label="Approved" count={totalApproved} total={totalAssets} color="var(--color-primary-moss-green)" />
          </div>
        )}

        {/* Next step guidance */}
        {nextStep && (
          <div className="project-overview-next">
            <span className="project-overview-next-label">Next step</span>
            <strong>{nextStep.label}</strong>
            <span className="project-overview-next-detail">{nextStep.detail}</span>
          </div>
        )}

        {/* Zone breakdown */}
        {zoneStats.length > 0 && (
          <div className="project-overview-zones">
            {zoneStats.map((z) => (
              <div key={z.key} className="project-overview-zone">
                <span className="project-overview-zone-name">{z.zone.zoneName}</span>
                <span className="project-overview-zone-counts">
                  {z.rooms > 0 && `${z.rooms} rooms`}
                  {z.mobs > 0 && `${z.rooms > 0 ? ", " : ""}${z.mobs} mobs`}
                  {z.items > 0 && `${z.rooms > 0 || z.mobs > 0 ? ", " : ""}${z.items} items`}
                  {z.total === 0 && "no entities"}
                </span>
                <span className="project-overview-zone-status">
                  {z.approved}/{z.total} approved
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="project-overview-hint">
          Select an entity from the sidebar to view and edit its image.
        </p>
      </div>
    </div>
  );
}

function PipelineStage({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  if (count === 0) return null;
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="pipeline-stage">
      <div className="pipeline-stage-bar" style={{ width: `${pct}%`, background: color }} />
      <span className="pipeline-stage-label" style={{ color }}>{count}</span>
      <span className="pipeline-stage-text">{label}</span>
    </div>
  );
}
