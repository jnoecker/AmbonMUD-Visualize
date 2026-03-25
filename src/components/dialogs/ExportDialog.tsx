import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { useDialogA11y } from "../../hooks/a11y";
import { exportProject, type ExportProgress } from "../../lib/export";

interface ExportDialogProps {
  onClose: () => void;
}

export function ExportDialog({ onClose }: ExportDialogProps) {
  const { project, projectDir } = useProject();
  const { settings, updateSettings } = useSettings();
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportDir, setExportDir] = useState<string | null>(settings.lastExportDir);

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
      updateSettings({ lastExportDir: exportDir });
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

  const dialogRef = useDialogA11y(exporting ? undefined : onClose);

  return (
    <div className="dialog-overlay" onClick={exporting ? undefined : onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title" ref={dialogRef} onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title" id="export-dialog-title">Export to World</h2>

        {!done && !exporting && (
          <div className="export-config">
            <p className="export-config-label">Export directory:</p>
            <div className="export-dir-row">
              <div className={`export-dir-path${exportDir ? "" : " export-dir-path--empty"}`}>
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
            <ul className="export-summary-list">
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
          <div className="inline-success">
            Export complete!
            {exportDir
              ? ` Files written to ${exportDir}`
              : " YAML files updated and images copied."}
          </div>
        )}

        {error && (
          <div className="inline-error">{error}</div>
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
