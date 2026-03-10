import { useCallback, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { generateSpriteTemplate, fillSpriteTemplate } from "../../lib/sprite-prompt-gen";
import { generateImage, getAspectRatio, bytesToBase64 } from "../../lib/image-gen";
import { parseSpriteId } from "../../lib/sprite-parser";
import type { Entity } from "../../types/entities";
import type { SpriteConfig, SpritePromptTemplate } from "../../types/sprites";

interface SpriteBatchBarProps {
  zoneKey: string;
  spriteConfig: SpriteConfig;
  spriteTemplate: SpritePromptTemplate | null;
  zoneVibe: string | null;
  entities: Entity[];
  /** Entity IDs currently visible in the grid (for "Generate Visible" button). */
  visibleEntityIds: string[];
  onTemplateGenerated: (template: SpritePromptTemplate) => void;
}

interface BatchProgress {
  total: number;
  completed: number;
  errors: number;
  currentEntity: string | null;
  phase: "base" | "classed" | null;
  lastError?: string;
}

/** Runware model for base race sprite generation (FLUX Dev — best style adherence). */
const SPRITE_MODEL_BASE = "runware:101@1";

/** Runware model for classed sprite text-to-image fallback (FLUX 2 — cheap). */
const SPRITE_MODEL_T2I = "runware:400@2";

/** Runware model for img2img sprite generation (FLUX Dev — supports seedImage). */
const SPRITE_MODEL_I2I = "runware:101@1";

/** Strength of seed image influence for img2img sprite generation. */
const SEED_STRENGTH = 0.65;

export function SpriteBatchBar({
  zoneKey,
  spriteConfig,
  spriteTemplate,
  zoneVibe,
  entities,
  visibleEntityIds,
  onTemplateGenerated,
}: SpriteBatchBarProps) {
  const { settings } = useSettings();
  const { getAsset, updatePrompt, addVariant, batchApprove, getVariantImageBytes } = useProject();
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateSuccess, setTemplateSuccess] = useState<string | null>(null);

  const handleGenerateTemplate = useCallback(async () => {
    if (!settings.anthropicApiKey) {
      setTemplateError("Anthropic API key not set. Open Settings.");
      return;
    }
    if (!zoneVibe) {
      setTemplateError("Generate a zone vibe first.");
      return;
    }
    setGeneratingTemplate(true);
    setTemplateError(null);
    setTemplateSuccess(null);
    try {
      // Gather sample names for each tier
      const sampleNames: Record<string, string> = {};
      for (const tier of spriteConfig.tiers) {
        const entity = entities.find((e) => {
          const dims = parseSpriteId(e.id);
          return dims && dims.tier === tier;
        });
        if (entity) sampleNames[tier] = entity.title;
      }

      console.log("[sprites] generating new template with races:", spriteConfig.races, "classes:", spriteConfig.classes);
      const template = await generateSpriteTemplate(
        settings.anthropicApiKey,
        spriteConfig,
        sampleNames,
        zoneVibe
      );
      console.log("[sprites] template generated, raceDescriptions keys:", Object.keys(template.raceDescriptions || {}));
      await onTemplateGenerated(template);
      setTemplateSuccess(`Template regenerated at ${new Date().toLocaleTimeString()}. Re-generate prompts to apply.`);
    } catch (err) {
      console.error("[sprites] template generation failed:", err);
      setTemplateError(err instanceof Error ? err.message : "Failed to generate template");
    } finally {
      setGeneratingTemplate(false);
    }
  }, [settings.anthropicApiKey, zoneVibe, spriteConfig, entities, onTemplateGenerated]);

  const handleRefillPrompts = useCallback(async () => {
    if (!spriteTemplate) return;
    const mobs = entities.filter((e) => e.type === "mob");
    let count = 0;
    for (const entity of mobs) {
      const dims = parseSpriteId(entity.id);
      if (!dims) continue;
      const prompt = fillSpriteTemplate(spriteTemplate, dims, entity.title);
      await updatePrompt(zoneKey, entity.id, prompt);
      count++;
    }
    setTemplateSuccess(`Refilled ${count} prompts from template.`);
  }, [spriteTemplate, entities, zoneKey, updatePrompt]);

  /**
   * Get the approved base race image bytes for a given race.
   * Looks for an approved {race}_base_t0 sprite.
   */
  const getBaseRaceImageBase64 = useCallback(
    async (race: string): Promise<string | null> => {
      // Find the base entity for this race
      const baseEntity = entities.find((e) => {
        const dims = parseSpriteId(e.id);
        return dims && dims.race === race && dims.playerClass === "base" && dims.tier === "t0";
      });
      if (!baseEntity) return null;

      const asset = getAsset(zoneKey, baseEntity.id);
      if (!asset) return null;

      // Use approved variant, or latest if none approved
      const variantIdx = asset.approvedVariantIndex ?? (asset.variants.length - 1);
      const variant = asset.variants[variantIdx];
      if (!variant) return null;

      try {
        const bytes = await getVariantImageBytes(zoneKey, baseEntity.id, variant.filename);
        return bytesToBase64(bytes);
      } catch {
        return null;
      }
    },
    [zoneKey, entities, getAsset, getVariantImageBytes]
  );

  const runBatch = useCallback(
    async (entityIds: string[], regenerate = false) => {
      if (!spriteTemplate || !settings.runwareApiKey) return;
      const template = spriteTemplate;

      const controller = new AbortController();
      setAbortController(controller);

      // Separate base sprites (t0, tstaff) from classed sprites
      const baseIds: string[] = [];
      const classedIds: string[] = [];

      for (const id of entityIds) {
        if (!regenerate) {
          const asset = getAsset(zoneKey, id);
          if (asset && asset.variants.length > 0) continue; // skip already generated
        }

        const dims = parseSpriteId(id);
        if (!dims) continue;

        if (dims.playerClass === "base") {
          baseIds.push(id);
        } else {
          classedIds.push(id);
        }
      }

      console.log(`[sprites] batch: ${baseIds.length} base, ${classedIds.length} classed (from ${entityIds.length} input, regenerate=${regenerate})`);
      if (baseIds.length > 0) console.log("[sprites] base IDs:", baseIds.slice(0, 5).join(", "), baseIds.length > 5 ? `... +${baseIds.length - 5}` : "");
      if (classedIds.length > 0) console.log("[sprites] classed IDs:", classedIds.slice(0, 5).join(", "), classedIds.length > 5 ? `... +${classedIds.length - 5}` : "");

      const totalCount = baseIds.length + classedIds.length;
      const progress: BatchProgress = {
        total: totalCount,
        completed: 0,
        errors: 0,
        currentEntity: null,
        phase: baseIds.length > 0 ? "base" : "classed",
      };
      setBatchProgress({ ...progress });

      const concurrency = settings.batchConcurrency || 20;

      // Helper to process a single entity
      async function processEntity(entityId: string, seedImageB64: string | null) {
        const entity = entities.find((e) => e.id === entityId);
        if (!entity) return;

        progress.currentEntity = entity.title;
        setBatchProgress({ ...progress });

        let succeeded = false;
        let generatedImage: Uint8Array | null = null;
        let prompt: string | null = null;

        for (let attempt = 0; attempt < 2 && !succeeded; attempt++) {
          try {
            if (!prompt) {
              const dims = parseSpriteId(entityId);
              if (!dims) return;
              prompt = fillSpriteTemplate(template, dims, entity.title);
              await updatePrompt(zoneKey, entityId, prompt);
            }

            if (controller.signal.aborted) return;

            if (!generatedImage) {
              const genOptions: {
                aspectRatio: "16:9" | "1:1";
                entityType: typeof entity.type;
                removeBackground: boolean;
                seedImage?: string;
                seedStrength?: number;
              } = {
                aspectRatio: getAspectRatio(entity.type),
                entityType: entity.type,
                removeBackground: settings.removeBackground,
              };

              // Pick model: FLUX Pro for bases, FLUX Dev for img2img classed, FLUX 2 for text-only fallback
              const useImg2Img = !!seedImageB64;
              if (useImg2Img) {
                genOptions.seedImage = seedImageB64;
                genOptions.seedStrength = SEED_STRENGTH;
              }

              const dims = parseSpriteId(entityId);
              const isBase = dims?.playerClass === "base";
              let model = SPRITE_MODEL_T2I;
              if (isBase) model = SPRITE_MODEL_BASE;
              else if (useImg2Img) model = SPRITE_MODEL_I2I;

              console.log(`[sprites] generating ${entityId} with model=${model} img2img=${useImg2Img}`);
              const result = await generateImage(
                settings.runwareApiKey!,
                prompt,
                genOptions,
                model
              );
              generatedImage = result.bytes;
            }
            await addVariant(zoneKey, entityId, generatedImage, prompt);
            succeeded = true;
          } catch (err: any) {
            const errMsg = err?.message || err?.errorMessage || (typeof err === 'object' ? JSON.stringify(err) : String(err));
            console.error(`[sprites] error generating ${entityId} (attempt ${attempt + 1}):`, errMsg, err);
            if (attempt === 1) {
              progress.errors++;
              progress.lastError = errMsg;
            }
          }
        }

        progress.completed++;
        setBatchProgress({ ...progress });
      }

      // Helper to run a batch of IDs with concurrency, using a seed lookup function
      async function runPool(
        ids: string[],
        getSeed: (id: string) => Promise<string | null>
      ) {
        let index = 0;
        async function worker() {
          while (index < ids.length) {
            if (controller.signal.aborted) return;
            const entityId = ids[index++];
            const seed = await getSeed(entityId);
            await processEntity(entityId, seed);
          }
        }
        const workers = Array.from(
          { length: Math.min(concurrency, ids.length) },
          () => worker()
        );
        await Promise.all(workers);
      }

      // Phase 1: Generate base race sprites (text-to-image, no seed)
      if (baseIds.length > 0) {
        progress.phase = "base";
        setBatchProgress({ ...progress });
        await runPool(baseIds, async () => null);
      }

      // Phase 2: Generate classed sprites (img2img from base race)
      if (classedIds.length > 0 && !controller.signal.aborted) {
        progress.phase = "classed";
        setBatchProgress({ ...progress });

        // Cache base race images to avoid re-reading for every sprite
        const seedCache = new Map<string, string | null>();

        await runPool(classedIds, async (entityId) => {
          const dims = parseSpriteId(entityId);
          if (!dims) return null;
          if (!seedCache.has(dims.race)) {
            const b64 = await getBaseRaceImageBase64(dims.race);
            seedCache.set(dims.race, b64);
          }
          return seedCache.get(dims.race) ?? null;
        });
      }

      progress.currentEntity = null;
      progress.phase = null;
      setBatchProgress({ ...progress });
      setAbortController(null);
    },
    [spriteTemplate, settings, zoneKey, entities, getAsset, updatePrompt, addVariant, getBaseRaceImageBase64]
  );

  const handleAbort = useCallback(() => {
    abortController?.abort();
  }, [abortController]);

  const handleBatchApprove = useCallback(async () => {
    const count = await batchApprove();
    if (count > 0) {
      setBatchProgress(null);
    }
  }, [batchApprove]);

  // Count how many base race sprites are approved
  const baseRaceStats = (() => {
    let total = 0;
    let approved = 0;
    let generated = 0;
    for (const entity of entities) {
      const dims = parseSpriteId(entity.id);
      if (dims && dims.playerClass === "base" && dims.tier === "t0") {
        total++;
        const asset = getAsset(zoneKey, entity.id);
        if (asset && asset.status === "approved") approved++;
        else if (asset && asset.variants.length > 0) generated++;
      }
    }
    return { total, approved, generated };
  })();

  const running = batchProgress !== null && abortController !== null;
  const completed = batchProgress !== null && abortController === null;
  const hasUnapprovedBases = baseRaceStats.total > 0 && baseRaceStats.approved < baseRaceStats.total;
  const basesGenerated = baseRaceStats.generated + baseRaceStats.approved;

  return (
    <div className="sprite-batch-bar">
      {/* Template generation */}
      {!spriteTemplate ? (
        <div className="sprite-batch-section">
          <button
            className="soft-button soft-button--primary"
            onClick={handleGenerateTemplate}
            disabled={generatingTemplate || !zoneVibe}
          >
            {generatingTemplate && <span className="spinner spinner--small" />}
            {!zoneVibe ? "Generate Zone Vibe First" : "Generate Prompt Template"}
          </button>
          {templateError && (
            <span className="sprite-batch-error">{templateError}</span>
          )}
        </div>
      ) : (
        <div className="sprite-batch-section">
          <button
            className="soft-button soft-button--primary"
            onClick={() => runBatch(visibleEntityIds)}
            disabled={running || !spriteTemplate}
          >
            {running && <span className="spinner spinner--small" />}
            Generate Visible ({visibleEntityIds.length})
          </button>
          <button
            className="soft-button"
            onClick={() => runBatch(entities.filter((e) => e.type === "mob").map((e) => e.id))}
            disabled={running || !spriteTemplate}
          >
            Generate All ({entities.filter((e) => e.type === "mob").length})
          </button>
          <button
            className="soft-button"
            onClick={() => runBatch(visibleEntityIds, true)}
            disabled={running || !spriteTemplate}
          >
            Regenerate Visible ({visibleEntityIds.length})
          </button>
          <button
            className="soft-button"
            onClick={handleRefillPrompts}
            disabled={running || !spriteTemplate}
          >
            Refill All Prompts
          </button>
          <button
            className="soft-button"
            onClick={handleGenerateTemplate}
            disabled={running || generatingTemplate || !zoneVibe}
          >
            {generatingTemplate && <span className="spinner spinner--small" />}
            Regenerate Template
          </button>
          <button
            className="soft-button soft-button--success"
            onClick={handleBatchApprove}
            disabled={running}
          >
            Approve Single-Variant
          </button>
          {running && (
            <button className="soft-button soft-button--danger" onClick={handleAbort}>
              Abort
            </button>
          )}
          {templateError && (
            <span className="sprite-batch-error">{templateError}</span>
          )}
          {templateSuccess && !templateError && (
            <span className="sprite-batch-success">{templateSuccess}</span>
          )}
        </div>
      )}

      {/* Base race status hint */}
      {spriteTemplate && hasUnapprovedBases && basesGenerated > 0 && !running && (
        <div className="sprite-batch-hint">
          {baseRaceStats.approved}/{baseRaceStats.total} base race sprites approved.
          Approve base sprites first — classed sprites use them as reference images for consistency.
        </div>
      )}

      {/* Progress */}
      {batchProgress && (
        <div className="sprite-batch-progress">
          <div className="sprite-batch-progress-bar">
            <div
              className="sprite-batch-progress-fill"
              style={{
                width: `${batchProgress.total > 0
                  ? (batchProgress.completed / batchProgress.total) * 100
                  : 0}%`,
              }}
            />
          </div>
          <span className="sprite-batch-progress-text">
            {batchProgress.phase === "base" && "Base sprites: "}
            {batchProgress.phase === "classed" && "Classed sprites (img2img): "}
            {batchProgress.completed}/{batchProgress.total}
            {batchProgress.errors > 0 && ` (${batchProgress.errors} errors)`}
            {batchProgress.currentEntity && ` - ${batchProgress.currentEntity}`}
            {completed && " - Done!"}
          </span>
          {batchProgress.lastError && (
            <span className="sprite-batch-error">Last error: {batchProgress.lastError}</span>
          )}
        </div>
      )}
    </div>
  );
}
