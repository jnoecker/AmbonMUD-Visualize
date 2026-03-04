import { useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useProject } from "../../context/ProjectContext";
import { exportProject, type ExportProgress } from "../../lib/export";

interface ExportDialogProps {
  onClose: () => void;
}

export function ExportDialog({ onClose }: ExportDialogProps) {
  const { project, projectDir } = useProject();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Count approved assets
  let approvedCount = 0;
  if (project) {
    for (const zone of Object.values(project.zones)) {
      for (const asset of Object.values(zone.assets)) {
        if (asset.status === "approved") approvedCount++;
      }
    }
  }

  const handleExport = async () => {
    if (!project || !projectDir) return;

    const result = await saveDialog({
      title: "Choose export directory",
      defaultPath: "export",
    });
    if (!result) return;

    setExporting(true);
    setError(null);
    try {
      await exportProject(projectDir, project, result, setProgress);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={exporting ? undefined : onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Export Project</h2>

        {!done && !exporting && (
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            <p>Export will include:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li>Modified YAML files with <code>image:</code> fields</li>
              <li>{approvedCount} approved image{approvedCount !== 1 ? "s" : ""}</li>
            </ul>
          </div>
        )}

        {progress && (
          <div className="batch-progress-info">
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
            {progress.currentFile && (
              <div className="batch-current-entity">
                Exporting: {progress.currentFile}
              </div>
            )}
          </div>
        )}

        {done && (
          <div style={{ color: "var(--color-success)", fontSize: "0.85rem" }}>
            Export complete!
          </div>
        )}

        {error && (
          <div style={{ color: "var(--color-error)", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        <div className="dialog-actions">
          {done ? (
            <button className="soft-button soft-button--primary" onClick={onClose}>
              Done
            </button>
          ) : (
            <>
              <button className="soft-button" onClick={onClose} disabled={exporting}>
                Cancel
              </button>
              <button
                className="soft-button soft-button--success"
                onClick={handleExport}
                disabled={exporting || approvedCount === 0}
              >
                {exporting && <span className="spinner spinner--small" />}
                Export
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
