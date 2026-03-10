import { useCallback, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { generatePortraitTemplate, fillPortraitTemplate } from "../../lib/portrait-prompt-gen";
import { generateImage } from "../../lib/image-gen";
import { parsePortraitId } from "../../lib/portrait-parser";
import type { Entity } from "../../types/entities";
import type { PortraitConfig, PortraitPromptTemplate } from "../../types/portraits";

interface PortraitBatchBarProps {
  zoneKey: string;
  portraitConfig: PortraitConfig;
  portraitTemplate: PortraitPromptTemplate | null;
  zoneVibe: string | null;
  entities: Entity[];
  onTemplateGenerated: (template: PortraitPromptTemplate) => void;
}

interface BatchProgress {
  total: number;
  completed: number;
  errors: number;
  currentEntity: string | null;
  lastError?: string;
}

/** FLUX 2 for portraits — same price as Schnell, good quality. */
const PORTRAIT_MODEL = "runware:400@2";

/** Concurrent generation limit. */
const CONCURRENCY = 4;

export function PortraitBatchBar({
  zoneKey,
  portraitConfig,
  portraitTemplate,
  zoneVibe,
  entities,
  onTemplateGenerated,
}: PortraitBatchBarProps) {
  const { settings } = useSettings();
  const { getAsset, updatePrompt, addVariant, batchApprove } = useProject();
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
      const template = await generatePortraitTemplate(
        settings.anthropicApiKey,
        portraitConfig,
        zoneVibe
      );
      onTemplateGenerated(template);
      setTemplateSuccess("Template generated successfully.");
    } catch (err: any) {
      setTemplateError(err?.message || "Failed to generate template");
    } finally {
      setGeneratingTemplate(false);
    }
  }, [settings.anthropicApiKey, portraitConfig, zoneVibe, onTemplateGenerated]);

  const handleBatch = useCallback(
    async (entityIds: string[], skipGenerated: boolean) => {
      if (!portraitTemplate) return;
      const template: PortraitPromptTemplate = portraitTemplate;
      if (!settings.runwareApiKey) {
        setTemplateError("Runware API key not set. Open Settings.");
        return;
      }

      const controller = new AbortController();
      setAbortController(controller);

      const ids = entityIds.filter((id) => {
        if (!skipGenerated) return true;
        const asset = getAsset(zoneKey, id);
        return !asset || asset.variants.length === 0;
      });

      const progress: BatchProgress = {
        total: ids.length,
        completed: 0,
        errors: 0,
        currentEntity: null,
      };
      setBatchProgress({ ...progress });

      async function processEntity(entityId: string) {
        if (controller.signal.aborted) return;

        const entity = entities.find((e) => e.id === entityId);
        if (!entity) return;

        progress.currentEntity = entity.title;
        setBatchProgress({ ...progress });

        let succeeded = false;

        for (let attempt = 0; attempt < 2 && !succeeded; attempt++) {
          try {
            // Always refill from template to pick up template changes
            const dims = parsePortraitId(entityId);
            if (!dims) return;
            const prompt = fillPortraitTemplate(template, dims);
            await updatePrompt(zoneKey, entityId, prompt);

            if (controller.signal.aborted) return;

            const result = await generateImage(
              settings.runwareApiKey!,
              prompt,
              {
                aspectRatio: "2:3",
                entityType: entity.type,
                removeBackground: false,
              },
              PORTRAIT_MODEL
            );
            await addVariant(zoneKey, entityId, result.bytes, prompt);
            succeeded = true;
          } catch (err: any) {
            const errMsg = err?.message || String(err);
            console.error(`[portraits] error generating ${entityId} (attempt ${attempt + 1}):`, errMsg);
            if (attempt === 1) {
              progress.errors++;
              progress.lastError = errMsg;
            }
          }
        }

        progress.completed++;
        setBatchProgress({ ...progress });
      }

      // Run with concurrency pool
      let index = 0;
      async function worker() {
        while (index < ids.length) {
          if (controller.signal.aborted) return;
          const entityId = ids[index++];
          await processEntity(entityId);
        }
      }
      const workers = Array.from(
        { length: Math.min(CONCURRENCY, ids.length) },
        () => worker()
      );
      await Promise.all(workers);

      progress.currentEntity = null;
      setBatchProgress({ ...progress });
      setAbortController(null);
    },
    [portraitTemplate, settings, zoneKey, entities, getAsset, updatePrompt, addVariant]
  );

  const handleAbort = useCallback(() => {
    abortController?.abort();
  }, [abortController]);

  const handleRefillPrompts = useCallback(async () => {
    if (!portraitTemplate) return;
    const template: PortraitPromptTemplate = portraitTemplate;
    let count = 0;
    for (const entity of entities) {
      if (entity.type !== "mob") continue;
      const dims = parsePortraitId(entity.id);
      if (!dims) continue;
      const prompt = fillPortraitTemplate(template, dims);
      await updatePrompt(zoneKey, entity.id, prompt);
      count++;
    }
    setTemplateSuccess(`Refilled ${count} prompts from template.`);
  }, [portraitTemplate, entities, zoneKey, updatePrompt]);

  const handleBatchApprove = useCallback(async () => {
    const count = await batchApprove();
    if (count > 0) {
      setBatchProgress(null);
    }
  }, [batchApprove]);

  const mobIds = entities.filter((e) => e.type === "mob").map((e) => e.id);
  const raceIds = mobIds.filter((id) => parsePortraitId(id)?.portraitType === "race");
  const classIds = mobIds.filter((id) => parsePortraitId(id)?.portraitType === "class");

  const running = batchProgress !== null && abortController !== null;
  const completed = batchProgress !== null && abortController === null;

  return (
    <div className="sprite-batch-bar glass-panel">
      {/* Template section */}
      {!portraitTemplate ? (
        <div className="sprite-batch-section">
          <button
            className="soft-button"
            onClick={handleGenerateTemplate}
            disabled={generatingTemplate || !zoneVibe}
            title={!zoneVibe ? "Generate a zone vibe first" : undefined}
          >
            {generatingTemplate ? "Generating Template..." : "Generate Prompt Template"}
          </button>
          {!zoneVibe && (
            <span className="sprite-batch-hint">Zone vibe required first</span>
          )}
        </div>
      ) : (
        <div className="sprite-batch-section">
          <button
            className="soft-button"
            onClick={() => handleBatch(raceIds, true)}
            disabled={running || raceIds.length === 0}
          >
            Generate Races ({raceIds.length})
          </button>
          <button
            className="soft-button"
            onClick={() => handleBatch(classIds, true)}
            disabled={running || classIds.length === 0}
          >
            Generate Classes ({classIds.length})
          </button>
          <button
            className="soft-button"
            onClick={() => handleBatch(mobIds, true)}
            disabled={running}
          >
            Generate All ({mobIds.length})
          </button>
          <button
            className="soft-button"
            onClick={() => handleBatch(mobIds, false)}
            disabled={running}
          >
            Regenerate All
          </button>
          <button
            className="soft-button soft-button--small"
            onClick={handleRefillPrompts}
            disabled={running}
          >
            Refill Prompts
          </button>
          <button
            className="soft-button soft-button--small"
            onClick={handleGenerateTemplate}
            disabled={generatingTemplate}
          >
            {generatingTemplate ? "Regenerating..." : "Regenerate Template"}
          </button>
          <button
            className="soft-button soft-button--approve soft-button--small"
            onClick={handleBatchApprove}
            disabled={running}
          >
            Approve Single-Variant
          </button>
        </div>
      )}

      {templateError && (
        <div className="sprite-batch-error">{templateError}</div>
      )}
      {templateSuccess && !templateError && (
        <div className="sprite-batch-success">{templateSuccess}</div>
      )}

      {/* Progress */}
      {batchProgress && (
        <div className="sprite-batch-progress">
          {running && (
            <button className="soft-button soft-button--small" onClick={handleAbort}>
              Abort
            </button>
          )}
          <div className="sprite-batch-progress-bar">
            <div
              className="sprite-batch-progress-fill"
              style={{ width: `${(batchProgress.completed / batchProgress.total) * 100}%` }}
            />
          </div>
          <span className="sprite-batch-progress-text">
            {batchProgress.completed}/{batchProgress.total}
            {batchProgress.errors > 0 && ` (${batchProgress.errors} errors)`}
          </span>
          {batchProgress.currentEntity && (
            <span className="sprite-batch-current">{batchProgress.currentEntity}</span>
          )}
          {completed && <span className="sprite-batch-done">Done!</span>}
          {batchProgress.lastError && (
            <div className="sprite-batch-error" style={{ marginTop: "var(--space-1)" }}>
              Last error: {batchProgress.lastError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
