import { useState } from "react";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { useProject } from "../../context/ProjectContext";

interface NewProjectDialogProps {
  onClose: () => void;
}

export function NewProjectDialog({ onClose }: NewProjectDialogProps) {
  const { createNewProject } = useProject();
  const [projectName, setProjectName] = useState("");
  const [yamlPaths, setYamlPaths] = useState<string[]>([]);
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddYaml = async () => {
    const result = await openDialog({
      multiple: true,
      filters: [{ name: "YAML", extensions: ["yaml", "yml"] }],
    });
    if (result) {
      const paths = Array.isArray(result) ? result : [result];
      setYamlPaths((prev) => [...prev, ...paths]);
    }
  };

  const handlePickDir = async () => {
    const result = await saveDialog({
      title: "Choose project directory",
      defaultPath: projectName || "my-project",
    });
    if (result) {
      // saveDialog returns a file path; use its parent + name as dir
      setProjectDir(result);
    }
  };

  const handleCreate = async () => {
    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }
    if (yamlPaths.length === 0) {
      setError("Add at least one YAML file");
      return;
    }
    if (!projectDir) {
      setError("Choose a project directory");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await createNewProject(projectDir, projectName, yamlPaths);
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
        <h2 className="dialog-title">New Project</h2>

        <div className="dialog-field">
          <label className="dialog-label">Project Name</label>
          <input
            className="dialog-input"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="My Zone Project"
          />
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Zone YAML Files</label>
          {yamlPaths.map((p, i) => (
            <div key={i} style={{ fontSize: "0.82rem", color: "var(--text-secondary)", padding: "2px 0" }}>
              {p.split(/[/\\]/).pop()}
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--color-error)",
                  cursor: "pointer",
                  marginLeft: 8,
                  fontSize: "0.78rem",
                }}
                onClick={() => setYamlPaths((prev) => prev.filter((_, j) => j !== i))}
              >
                remove
              </button>
            </div>
          ))}
          <button className="soft-button soft-button--small" onClick={handleAddYaml}>
            Add YAML File
          </button>
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
