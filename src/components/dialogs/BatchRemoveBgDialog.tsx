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
  const [progress, setProgress] = useState<BgProgress | null>(null);
  const abortRef = useRef(false);

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
    if (!settings.runwareApiKey) return;

    setRunning(true);
    abortRef.current = false;

    const prog: BgProgress = {
      total: eligibleItems.length,
      completed: 0,
      currentEntity: null,
      errors: [],
    };
    setProgress({ ...prog });

    // Process with concurrency limit
    let index = 0;
    const concurrency = settings.batchConcurrency;

    async function processNext(): Promise<void> {
      while (index < eligibleItems.length) {
        if (abortRef.current) return;

        const item = eligibleItems[index++];
        prog.currentEntity = item.title;
        setProgress({ ...prog });

        try {
          const bytes = await getVariantImageBytes(item.zoneKey, item.entityId, item.filename);
          if (abortRef.current) return;

          const processed = await removeImageBackground(settings.runwareApiKey, bytes);
          if (abortRef.current) return;

          await replaceVariantImage(item.zoneKey, item.entityId, item.variantIndex, processed);
        } catch (err) {
          prog.errors.push({
            entityId: item.entityId,
            error: err instanceof Error ? err.message : String(err),
          });
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
    setRunning(false);
    setDone(true);
    await reloadProject();
  }, [eligibleItems, settings.runwareApiKey, getVariantImageBytes, replaceVariantImage, reloadProject]);

  const handleAbort = () => {
    abortRef.current = true;
  };

  const pct =
    progress && progress.total > 0
      ? (progress.completed / progress.total) * 100
      : 0;

  return (
    <div className="dialog-overlay" onClick={running ? undefined : onClose}>
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
                {progress.errors.length} error{progress.errors.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}

        <div className="dialog-actions">
          {running ? (
            <button className="soft-button soft-button--danger" onClick={handleAbort}>
              Abort
            </button>
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
