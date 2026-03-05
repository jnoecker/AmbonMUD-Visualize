import { useCallback, useRef, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { recompressForEntityType } from "../../lib/image-gen";

interface BatchRecompressDialogProps {
  onClose: () => void;
}

interface RecompressProgress {
  total: number;
  completed: number;
  skipped: number;
  saved: number;
  currentEntity: string | null;
  errors: Array<{ entityId: string; error: string }>;
}

export function BatchRecompressDialog({ onClose }: BatchRecompressDialogProps) {
  const { project, getVariantImageBytes, replaceVariantImage, reloadProject } = useProject();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<RecompressProgress | null>(null);
  const abortRef = useRef(false);
  const runningRef = useRef(false);

  // Collect all assets with variants (approved variant if approved, all variants otherwise)
  const eligibleItems: Array<{
    zoneKey: string;
    entityId: string;
    title: string;
    entityType: "room" | "mob" | "item";
    variantIndex: number;
    filename: string;
  }> = [];

  if (project) {
    for (const [zoneKey, zone] of Object.entries(project.zones)) {
      for (const asset of Object.values(zone.assets)) {
        if (asset.variants.length === 0) continue;
        if (asset.status === "approved" && asset.approvedVariantIndex !== null) {
          const variant = asset.variants[asset.approvedVariantIndex];
          if (variant) {
            eligibleItems.push({
              zoneKey,
              entityId: asset.entityId,
              title: asset.title,
              entityType: asset.entityType,
              variantIndex: asset.approvedVariantIndex,
              filename: variant.filename,
            });
          }
        } else {
          // Recompress all variants
          for (let i = 0; i < asset.variants.length; i++) {
            eligibleItems.push({
              zoneKey,
              entityId: asset.entityId,
              title: asset.title,
              entityType: asset.entityType,
              variantIndex: i,
              filename: asset.variants[i].filename,
            });
          }
        }
      }
    }
  }

  const handleStart = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    abortRef.current = false;

    const prog: RecompressProgress = {
      total: eligibleItems.length,
      completed: 0,
      skipped: 0,
      saved: 0,
      currentEntity: null,
      errors: [],
    };
    setProgress({ ...prog });

    for (const item of eligibleItems) {
      if (abortRef.current) break;

      prog.currentEntity = item.title;
      setProgress({ ...prog });

      try {
        const bytes = await getVariantImageBytes(item.zoneKey, item.entityId, item.filename);
        const recompressed = await recompressForEntityType(bytes, item.entityType);

        // Skip if the result is the same size or larger (already optimized)
        if (recompressed.length >= bytes.length) {
          prog.skipped++;
        } else {
          const savedKB = Math.round((bytes.length - recompressed.length) / 1024);
          prog.saved += savedKB;
          await replaceVariantImage(item.zoneKey, item.entityId, item.variantIndex, recompressed);
        }
      } catch (err) {
        prog.errors.push({
          entityId: item.entityId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      prog.completed++;
      setProgress({ ...prog });
    }

    prog.currentEntity = null;
    setProgress({ ...prog });
    runningRef.current = false;
    setRunning(false);
    setDone(true);
    await reloadProject();
  }, [eligibleItems, getVariantImageBytes, replaceVariantImage, reloadProject]);

  const handleAbort = () => {
    abortRef.current = true;
  };

  const pct =
    progress && progress.total > 0
      ? (progress.completed / progress.total) * 100
      : 0;

  return (
    <div className="dialog-overlay" onClick={running && !done ? undefined : onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Recompress Images</h2>

        {!running && !done && (
          <>
            <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 12 }}>
              Downscales and recompresses all existing images to target sizes.
              Rooms are converted to JPEG (~20x smaller). Mobs downscale to 512px,
              items to 256px. Images already at or below target size are skipped.
              No API calls — purely local processing.
            </div>

            <div style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
              {eligibleItems.length} image{eligibleItems.length !== 1 ? "s" : ""} to process
            </div>
          </>
        )}

        {done && !running && (
          <div style={{ color: "var(--color-success)", fontSize: "0.85rem" }}>
            Recompression complete!
            {progress && progress.saved > 0 && (
              <span style={{ marginLeft: 8 }}>
                Saved {progress.saved >= 1024
                  ? `${(progress.saved / 1024).toFixed(1)}MB`
                  : `${progress.saved}KB`}
              </span>
            )}
            {progress && progress.skipped > 0 && (
              <span style={{ color: "var(--text-secondary)", marginLeft: 8 }}>
                ({progress.skipped} already optimized)
              </span>
            )}
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
              {progress.skipped > 0 && ` (${progress.skipped} skipped)`}
              {progress.saved > 0 && ` — saved ${progress.saved >= 1024
                ? `${(progress.saved / 1024).toFixed(1)}MB`
                : `${progress.saved}KB`}`}
            </div>
            {progress.currentEntity && (
              <div className="batch-current-entity">
                Processing: {progress.currentEntity}
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
                disabled={eligibleItems.length === 0}
              >
                Start ({eligibleItems.length})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
