import { useState } from "react";
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

  // Count approved assets and default images
  let approvedCount = 0;
  let defaultImageCount = 0;
  let zonePaths: string[] = [];
  if (project) {
    for (const zone of Object.values(project.zones)) {
      zonePaths.push(zone.sourceYamlPath);
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

  const handleExport = async () => {
    if (!project || !projectDir) return;

    setExporting(true);
    setError(null);
    try {
      await exportProject(projectDir, project, setProgress);
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
        <h2 className="dialog-title">Export to World</h2>

        {!done && !exporting && (
          <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            <p>This will export directly into the AmbonMUD world directory:</p>
            <ul style={{ paddingLeft: 20, marginTop: 8 }}>
              <li>
                Modify source YAML{zonePaths.length > 1 ? " files" : ""} in-place
                with <code>image:</code> fields
              </li>
              <li>
                Copy {approvedCount} approved image{approvedCount !== 1 ? "s" : ""}
                {defaultImageCount > 0 && ` + ${defaultImageCount} default image${defaultImageCount !== 1 ? "s" : ""}`}
                {" "}to <code>images/{"{zone}/"}</code> alongside the YAML
              </li>
            </ul>
            {zonePaths.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: "var(--space-2) var(--space-3)",
                  background: "var(--surface-subpanel)",
                  borderRadius: "var(--radius-md)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.78rem",
                  color: "var(--text-disabled)",
                  wordBreak: "break-all",
                }}
              >
                {zonePaths.map((p, i) => (
                  <div key={i}>{p}</div>
                ))}
              </div>
            )}
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
            Export complete! YAML files updated and images copied.
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
                Export to World
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
