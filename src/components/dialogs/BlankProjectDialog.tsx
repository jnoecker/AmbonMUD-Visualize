import { useState } from "react";
import { save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useProject } from "../../context/ProjectContext";

interface BlankProjectDialogProps {
  onClose: () => void;
}

export function BlankProjectDialog({ onClose }: BlankProjectDialogProps) {
  const { createNewBlankProject } = useProject();
  const [projectName, setProjectName] = useState("");
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickDir = async () => {
    const result = await saveDialog({
      title: "Choose project directory",
      defaultPath: projectName || "my-assets",
    });
    if (result) {
      setProjectDir(result);
    }
  };

  const handleCreate = async () => {
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }
    if (!projectDir) {
      setError("Choose a project directory");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createNewBlankProject(projectDir, projectName);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">New Blank Project</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 16 }}>
          Create a project for standalone assets — menu bars, icons, UI elements, and
          other art that conforms to the Surreal Gentle Magic style.
        </p>

        <div className="dialog-field">
          <label className="dialog-label">Project Name</label>
          <input
            className="dialog-input"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="My Asset Pack"
          />
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Project Directory</label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", flex: 1 }}>
              {projectDir || "Not selected"}
            </span>
            <button className="soft-button soft-button--small" onClick={handlePickDir}>
              Browse
            </button>
          </div>
        </div>

        {error && (
          <div style={{ color: "var(--color-error)", fontSize: "0.82rem", marginBottom: 12 }}>
            {error}
          </div>
        )}

        <div className="dialog-actions">
          <button className="soft-button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="soft-button soft-button--primary"
            onClick={handleCreate}
            disabled={loading}
          >
            {loading && <span className="spinner spinner--small" />}
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
