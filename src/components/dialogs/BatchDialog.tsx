import { useCallback, useRef, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { runBatch, type BatchProgress } from "../../lib/batch";
import { generateEntityPrompt } from "../../lib/prompt-gen";
import { generateImage, getAspectRatio } from "../../lib/image-gen";
import type { Entity } from "../../types/entities";

interface BatchDialogProps {
  onClose: () => void;
}

export function BatchDialog({ onClose }: BatchDialogProps) {
  const { project, parsedZones, addVariant, updatePrompt, reloadProject } = useProject();
  const { settings } = useSettings();
  const [skipGenerated, setSkipGenerated] = useState(true);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleStart = useCallback(async () => {
    if (!project) return;
    if (!settings.anthropicApiKey || !settings.runwareApiKey) {
      return;
    }

    setRunning(true);
    abortRef.current = new AbortController();

    for (const [zoneKey, zone] of Object.entries(project.zones)) {
      const parsed = parsedZones[zoneKey];
      if (!parsed || !zone.vibe) continue;

      await runBatch({
        entities: parsed.entities,
        assets: zone.assets,
        zoneVibe: zone.vibe,
        concurrency: settings.batchConcurrency,
        skipGenerated,
        generatePrompt: async (entity: Entity, vibe: string) => {
          const prompt = await generateEntityPrompt(
            settings.anthropicApiKey,
            entity,
            vibe
          );
          await updatePrompt(zoneKey, entity.id, prompt);
          return prompt;
        },
        generateImage: async (prompt: string, entity: Entity) => {
          return generateImage(settings.runwareApiKey, prompt, {
            aspectRatio: getAspectRatio(entity.type),
            entityType: entity.type,
          }, settings.runwareModel);
        },
        onSaveImage: async (entityId: string, data: Uint8Array, prompt: string) => {
          await addVariant(zoneKey, entityId, data, prompt);
        },
        onProgress: setProgress,
        abortSignal: abortRef.current.signal,
      });
    }

    setRunning(false);
    setDone(true);
    await reloadProject();
  }, [project, parsedZones, settings, skipGenerated, addVariant, updatePrompt, reloadProject]);

  const handleAbort = () => {
    abortRef.current?.abort();
  };

  const handleMinimize = () => {
    setMinimized(true);
  };

  const handleRestore = () => {
    setMinimized(false);
  };

  // Count entities that need processing
  let totalToProcess = 0;
  let missingVibe = false;
  if (project) {
    for (const [zoneKey, zone] of Object.entries(project.zones)) {
      if (!zone.vibe) {
        missingVibe = true;
        continue;
      }
      const parsed = parsedZones[zoneKey];
      if (!parsed) continue;
      for (const entity of parsed.entities) {
        const asset = zone.assets[entity.id];
        if (skipGenerated && asset?.variants.length > 0) continue;
        totalToProcess++;
      }
    }
  }

  const pct = progress && progress.total > 0
    ? (progress.completed / progress.total) * 100
    : 0;

  // Minimized floating progress bar
  if (minimized) {
    return (
      <div className="batch-floating-bar" onClick={handleRestore}>
        <div className="batch-floating-progress">
          <div className="batch-floating-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="batch-floating-text">
          {done
            ? "Batch done!"
            : `Batch: ${progress?.completed ?? 0}/${progress?.total ?? 0}`}
          {progress && progress.errors.length > 0 && ` (${progress.errors.length} err)`}
        </span>
        {running && (
          <button
            className="soft-button soft-button--danger batch-floating-abort"
            onClick={(e) => { e.stopPropagation(); handleAbort(); }}
          >
            Abort
          </button>
        )}
        {done && (
          <button
            className="soft-button batch-floating-close"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            Dismiss
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="dialog-overlay" onClick={running && !done ? undefined : onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Batch Generate</h2>

        {!running && !done && (
          <>
            {missingVibe && (
              <div style={{ color: "var(--color-warning)", fontSize: "0.85rem", marginBottom: 12 }}>
                Some zones are missing vibes. Generate zone vibes first.
              </div>
            )}

            {(!settings.anthropicApiKey || !settings.runwareApiKey) && (
              <div style={{ color: "var(--color-error)", fontSize: "0.85rem", marginBottom: 12 }}>
                Both API keys must be configured in Settings.
              </div>
            )}

            <label className="checkbox-field">
              <input
                className="checkbox-input"
                type="checkbox"
                checked={skipGenerated}
                onChange={(e) => setSkipGenerated(e.target.checked)}
              />
              Skip entities that already have images
            </label>

            <div
              style={{
                marginTop: 12,
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
              }}
            >
              {totalToProcess} entities to process (concurrency: {settings.batchConcurrency})
            </div>
          </>
        )}

        {done && !running && (
          <div style={{ color: "var(--color-success)", fontSize: "0.85rem" }}>
            Batch generation complete!
            {progress && progress.errors.length > 0 && (
              <span style={{ color: "var(--color-error)", marginLeft: 8 }}>
                ({progress.errors.length} error{progress.errors.length !== 1 ? "s" : ""})
              </span>
            )}
          </div>
        )}

        {progress && (
          <div className="batch-progress-info">
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
              {progress.completed} / {progress.total} completed
            </div>
            {progress.currentEntity && (
              <div className="batch-current-entity">
                Processing: {progress.currentEntity}
              </div>
            )}
            {progress.errors.length > 0 && (
              <div style={{ color: "var(--color-error)", fontSize: "0.82rem" }}>
                {progress.errors.length} error{progress.errors.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}

        <div className="dialog-actions">
          {running ? (
            <>
              <button className="soft-button" onClick={handleMinimize}>
                Minimize
              </button>
              <button className="soft-button soft-button--danger" onClick={handleAbort}>
                Abort
              </button>
            </>
          ) : done ? (
            <button className="soft-button soft-button--primary" onClick={onClose}>
              Done
            </button>
          ) : (
            <>
              <button className="soft-button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="soft-button soft-button--primary"
                onClick={handleStart}
                disabled={
                  totalToProcess === 0 ||
                  !settings.anthropicApiKey ||
                  !settings.runwareApiKey
                }
              >
                Start ({totalToProcess})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
