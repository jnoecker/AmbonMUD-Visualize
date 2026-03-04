import { useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { generateZoneVibe } from "../../lib/prompt-gen";

interface ZoneVibePanelProps {
  zoneName: string;
  vibe: string | null;
  allRoomDescriptions: string[];
}

export function ZoneVibePanel({ zoneName, vibe, allRoomDescriptions }: ZoneVibePanelProps) {
  const { updateVibe } = useProject();
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(vibe || "");
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!settings.anthropicApiKey) {
      setError("Anthropic API key not set. Open Settings to configure.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const newVibe = await generateZoneVibe(
        settings.anthropicApiKey,
        zoneName,
        allRoomDescriptions
      );
      await updateVibe(zoneName, newVibe);
      setEditText(newVibe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate vibe");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    await updateVibe(zoneName, editText);
    setEditing(false);
  };

  return (
    <div className="glass-panel">
      <div className="glass-panel-header">
        <span className="glass-panel-title">Zone Vibe</span>
        <div style={{ display: "flex", gap: 6 }}>
          {vibe && !editing && (
            <button
              className="soft-button soft-button--small"
              onClick={() => { setEditText(vibe); setEditing(true); }}
            >
              Edit
            </button>
          )}
          <button
            className="soft-button soft-button--small soft-button--primary"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading && <span className="spinner spinner--small" />}
            {vibe ? "Regenerate" : "Generate Vibe"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: "var(--color-error)", fontSize: "0.82rem" }}>{error}</div>
      )}

      {editing ? (
        <div>
          <textarea
            className="zone-vibe-textarea"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button className="soft-button soft-button--small soft-button--success" onClick={handleSave}>
              Save
            </button>
            <button className="soft-button soft-button--small" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : vibe ? (
        <p className="zone-vibe-text">{vibe}</p>
      ) : (
        <p className="zone-vibe-text" style={{ fontStyle: "normal", opacity: 0.5 }}>
          No vibe generated yet. Click "Generate Vibe" to create one.
        </p>
      )}
    </div>
  );
}
