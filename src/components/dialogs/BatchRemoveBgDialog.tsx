import { useCallback, useRef, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { removeImageBackground } from "../../lib/image-gen";

interface BatchRemoveBgDialogProps {
  onClose: () => void;
}

interface BgProgress {
  total: number;
  completed: number;
  currentEntity: string | null;
  errors: Array<{ entityId: string; error: string }>;
}

export function BatchRemoveBgDialog({ onClose }: BatchRemoveBgDialogProps) {
  const { project, getVariantImageBytes, replaceVariantImage, reloadProject } = useProject();
  const { settings } = useSettings();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [progress, setProgress] = useState<BgProgress | null>(null);
  const abortRef = useRef(false);
  const runningRef = useRef(false);

  // Count eligible assets: approved mobs/items with variants
  let totalEligible = 0;
  const eligibleItems: Array<{
    zoneKey: string;
    entityId: string;
    title: string;
    variantIndex: number;
    filename: string;
  }> = [];

  if (project) {
    for (const [zoneKey, zone] of Object.entries(project.zones)) {
      for (const asset of Object.values(zone.assets)) {
        if (
          asset.entityType !== "room" &&
          asset.status === "approved" &&
          asset.approvedVariantIndex !== null &&
          asset.variants[asset.approvedVariantIndex]
        ) {
          eligibleItems.push({
            zoneKey,
            entityId: asset.entityId,
            title: asset.title,
            variantIndex: asset.approvedVariantIndex,
            filename: asset.variants[asset.approvedVariantIndex].filename,
          });
          totalEligible++;
        }
      }
    }
  }

  const handleStart = useCallback(async () => {
    if (!settings.runwareApiKey || runningRef.current) return;
    runningRef.current = true;

    setRunning(true);
    abortRef.current = false;

    const prog: BgProgress = {
      total: eligibleItems.length,
      completed: 0,
      currentEntity: null,
      errors: [],
    };
    setProgress({ ...prog });

    // BG removal sends large base64 payloads over WebSocket — keep concurrency
    // low to avoid timeouts (unlike image generation which sends tiny prompts).
    let index = 0;
    const concurrency = Math.min(settings.batchConcurrency, 3);

    async function processNext(): Promise<void> {
      while (index < eligibleItems.length) {
        if (abortRef.current) return;

        const item = eligibleItems[index++];
        prog.currentEntity = item.title;
        setProgress({ ...prog });

        let processed: Uint8Array | null = null;
        let succeeded = false;
        for (let attempt = 0; attempt < 2 && !succeeded; attempt++) {
          try {
            // Only call the API if we don't already have a result from a previous attempt
            if (!processed) {
              const bytes = await getVariantImageBytes(item.zoneKey, item.entityId, item.filename);
              if (abortRef.current) return;

              processed = await removeImageBackground(settings.runwareApiKey, bytes);
              if (abortRef.current) return;
            }

            await replaceVariantImage(item.zoneKey, item.entityId, item.variantIndex, processed);
            succeeded = true;
          } catch (err) {
            if (attempt === 1) {
              prog.errors.push({
                entityId: item.entityId,
                error: err instanceof Error ? err.message : String(err),
              });
            }
          }
        }

        prog.completed++;
        setProgress({ ...prog });
      }
    }

    const workers = Array.from(
      { length: Math.min(concurrency, eligibleItems.length) },
      () => processNext()
    );
    await Promise.all(workers);

    prog.currentEntity = null;
    setProgress({ ...prog });
    runningRef.current = false;
    setRunning(false);
    setDone(true);
    await reloadProject();
  }, [eligibleItems, settings.runwareApiKey, settings.batchConcurrency, getVariantImageBytes, replaceVariantImage, reloadProject]);

  const handleAbort = () => {
    abortRef.current = true;
  };

  const pct =
    progress && progress.total > 0
      ? (progress.completed / progress.total) * 100
      : 0;

  if (minimized) {
    return (
      <div className="batch-floating-bar" onClick={() => setMinimized(false)}>
        <div className="batch-floating-progress">
          <div className="batch-floating-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="batch-floating-text">
          {done
            ? "BG removal done!"
            : `Remove BG: ${progress?.completed ?? 0}/${progress?.total ?? 0}`}
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
        <h2 className="dialog-title">Batch Remove Backgrounds</h2>

        {!running && !done && (
          <>
            {!settings.runwareApiKey && (
              <div style={{ color: "var(--color-error)", fontSize: "0.85rem", marginBottom: 12 }}>
                Runware API key must be configured in Settings.
              </div>
            )}

            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 12 }}>
              Removes backgrounds from the <strong>approved variant</strong> of
              all mob and item assets. Room assets are skipped.
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
              {totalEligible} approved mob/item asset{totalEligible !== 1 ? "s" : ""} to process
              (~${(totalEligible * 0.004).toFixed(2)} estimated cost)
            </div>
          </>
        )}

        {done && !running && (
          <div style={{ color: "var(--color-success)", fontSize: "0.85rem" }}>
            Background removal complete!
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
              <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
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
                {progress.errors.map((e, i) => (
                  <div key={i}>{e.entityId}: {e.error}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="dialog-actions">
          {running ? (
            <>
              <button className="soft-button" onClick={() => setMinimized(true)}>
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
                disabled={totalEligible === 0 || !settings.runwareApiKey}
              >
                Start ({totalEligible})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
