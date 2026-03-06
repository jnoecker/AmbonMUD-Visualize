import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
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
  const [exportDir, setExportDir] = useState<string | null>(null);

  // Count approved assets and default images
  let approvedCount = 0;
  let defaultImageCount = 0;
  if (project) {
    for (const zone of Object.values(project.zones)) {
      for (const asset of Object.values(zone.assets)) {
        if (asset.status === "approved") approvedCount++;
      }
      if (zone.defaultImages) {
        for (const d of Object.values(zone.defaultImages)) {
          if (d?.filename) defaultImageCount++;
        }
      }
    }
  }
  const canExport = approvedCount > 0 || defaultImageCount > 0;

  const handlePickDir = async () => {
    const result = await openDialog({ directory: true, multiple: false });
    if (typeof result === "string") {
      setExportDir(result);
    }
  };

  const handleClearDir = () => setExportDir(null);

  const handleExport = async () => {
    if (!project || !projectDir) return;

    setExporting(true);
    setError(null);
    try {
      await exportProject(projectDir, project, setProgress, exportDir ?? undefined);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  // Display description of where files will go
  const targetDescription = exportDir
    ? exportDir
    : "Source YAML directory (in-place)";

  return (
    <div className="dialog-overlay" onClick={exporting ? undefined : onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Export to World</h2>

        {!done && !exporting && (
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            <p style={{ marginBottom: 8 }}>Export directory:</p>
            <div
              style={{
                display: "flex",
                gap: "var(--space-2)",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: "var(--space-2) var(--space-3)",
                  background: "var(--surface-subpanel)",
                  borderRadius: "var(--radius-md)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.78rem",
                  color: exportDir ? "var(--text-primary)" : "var(--text-disabled)",
                  wordBreak: "break-all",
                  minHeight: 32,
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {targetDescription}
              </div>
              <button className="soft-button" onClick={handlePickDir}>
                Browse
              </button>
              {exportDir && (
                <button
                  className="soft-button"
                  onClick={handleClearDir}
                  title="Reset to in-place export"
                >
                  Reset
                </button>
              )}
            </div>

            <p>This will:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li>
                {exportDir
                  ? <>Write zone YAML files to the export directory</>
                  : <>Modify source YAML files in-place</>}
                {" "}with <code>image:</code> fields and entity edits
              </li>
              <li>
                Copy {approvedCount} approved image{approvedCount !== 1 ? "s" : ""}
                {defaultImageCount > 0 && ` + ${defaultImageCount} default image${defaultImageCount !== 1 ? "s" : ""}`}
                {" "}to <code>images/{"{zone}/"}</code>
              </li>
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
            {exportDir
              ? ` Files written to ${exportDir}`
              : " YAML files updated and images copied."}
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
                disabled={exporting || !canExport}
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
