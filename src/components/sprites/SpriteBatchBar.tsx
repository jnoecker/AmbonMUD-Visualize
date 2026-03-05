import { useCallback, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { generateSpriteTemplate, fillSpriteTemplate } from "../../lib/sprite-prompt-gen";
import { generateImage, getAspectRatio } from "../../lib/image-gen";
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
}

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
  const { getAsset, updatePrompt, addVariant, batchApprove } = useProject();
  const [generatingTemplate, setGeneratingTemplate] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchProgress | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const handleGenerateTemplate = useCallback(async () => {
    if (!settings.anthropicApiKey || !zoneVibe) return;
    setGeneratingTemplate(true);
    setTemplateError(null);
    try {
      // Gather sample names for each tier
      const sampleNames: Record<number, string> = {};
      for (const tier of spriteConfig.tiers) {
        const entity = entities.find((e) => {
          const dims = parseSpriteId(e.id);
          return dims && dims.tier === tier;
        });
        if (entity) sampleNames[tier] = entity.title;
      }

      const template = await generateSpriteTemplate(
        settings.anthropicApiKey,
        spriteConfig,
        sampleNames,
        zoneVibe
      );
      onTemplateGenerated(template);
    } catch (err) {
      setTemplateError(err instanceof Error ? err.message : "Failed to generate template");
    } finally {
      setGeneratingTemplate(false);
    }
  }, [settings.anthropicApiKey, zoneVibe, spriteConfig, entities, onTemplateGenerated]);

  const runBatch = useCallback(
    async (entityIds: string[]) => {
      if (!spriteTemplate || !settings.runwareApiKey) return;
      const template = spriteTemplate; // narrow for closure

      const controller = new AbortController();
      setAbortController(controller);

      const toProcess = entityIds.filter((id) => {
        const asset = getAsset(zoneKey, id);
        return !asset || asset.variants.length === 0;
      });

      const progress: BatchProgress = {
        total: toProcess.length,
        completed: 0,
        errors: 0,
        currentEntity: null,
      };
      setBatchProgress({ ...progress });

      const concurrency = settings.batchConcurrency || 20;
      let index = 0;

      async function processNext() {
        while (index < toProcess.length) {
          if (controller.signal.aborted) return;

          const entityId = toProcess[index++];
          const entity = entities.find((e) => e.id === entityId);
          if (!entity) continue;

          progress.currentEntity = entity.title;
          setBatchProgress({ ...progress });

          try {
            // Fill prompt from template (no Claude call)
            const dims = parseSpriteId(entityId);
            if (!dims) continue;
            const prompt = fillSpriteTemplate(template, dims, entity.title);
            await updatePrompt(zoneKey, entityId, prompt);

            if (controller.signal.aborted) return;

            // Generate image
            const imageData = await generateImage(
              settings.runwareApiKey!,
              prompt,
              { aspectRatio: getAspectRatio(entity.type), entityType: entity.type },
              settings.runwareModel
            );
            await addVariant(zoneKey, entityId, imageData, prompt);
          } catch {
            progress.errors++;
          }

          progress.completed++;
          setBatchProgress({ ...progress });
        }
      }

      const workers = Array.from(
        { length: Math.min(concurrency, toProcess.length) },
        () => processNext()
      );
      await Promise.all(workers);

      progress.currentEntity = null;
      setBatchProgress({ ...progress });
      setAbortController(null);
    },
    [spriteTemplate, settings, zoneKey, entities, getAsset, updatePrompt, addVariant]
  );

  const handleAbort = useCallback(() => {
    abortController?.abort();
  }, [abortController]);

  const handleBatchApprove = useCallback(async () => {
    const count = await batchApprove();
    if (count > 0) {
      // Force re-render by briefly clearing progress
      setBatchProgress(null);
    }
  }, [batchApprove]);

  const running = batchProgress !== null && abortController !== null;
  const completed = batchProgress !== null && abortController === null;

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
            {batchProgress.completed}/{batchProgress.total}
            {batchProgress.errors > 0 && ` (${batchProgress.errors} errors)`}
            {batchProgress.currentEntity && ` - ${batchProgress.currentEntity}`}
            {completed && " - Done!"}
          </span>
        </div>
      )}
    </div>
  );
}
