import { useState } from "react";
import { useProject } from "../../context/ProjectContext";
import type { EntityType } from "../../types/entities";

interface CustomAssetDialogProps {
  onClose: () => void;
}

const FORMAT_OPTIONS: { value: EntityType; label: string; desc: string }[] = [
  { value: "room", label: "Room Background", desc: "16:9 landscape, 1920x1080" },
  { value: "mob", label: "Character Portrait", desc: "1:1 square, 512x512" },
  { value: "item", label: "Item Icon", desc: "1:1 square, 256x256" },
];

export function CustomAssetDialog({ onClose }: CustomAssetDialogProps) {
  const { project, addCustomAsset, selectEntity } = useProject();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("room");
  const [selectedZone, setSelectedZone] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zoneKeys = project ? Object.keys(project.zones) : [];

  // Default to first zone
  const zoneKey = selectedZone || zoneKeys[0] || "";

  const handleCreate = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!description.trim()) {
      setError("Description is required");
      return;
    }
    if (!zoneKey) {
      setError("No zone available. Open a project with zones first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const entityId = await addCustomAsset(zoneKey, title.trim(), description.trim(), entityType);
      if (entityId) {
        selectEntity(zoneKey, entityId);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create custom asset");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">New Custom Asset</h2>

        <div className="dialog-field">
          <label className="dialog-label">Title</label>
          <input
            className="dialog-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Enchanted Treasure Chest"
          />
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Description</label>
          <textarea
            className="dialog-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you want — Claude will transform it into a styled image prompt"
            rows={4}
            style={{ resize: "vertical" }}
          />
        </div>

        <div className="dialog-field">
          <label className="dialog-label">Format</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FORMAT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: "0.88rem",
                }}
              >
                <input
                  type="radio"
                  name="entityType"
                  value={opt.value}
                  checked={entityType === opt.value}
                  onChange={() => setEntityType(opt.value)}
                />
                <span>
                  <strong>{opt.label}</strong>
                  <span style={{ color: "var(--text-disabled)", marginLeft: 8, fontSize: "0.8rem" }}>
                    {opt.desc}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {zoneKeys.length > 1 && (
          <div className="dialog-field">
            <label className="dialog-label">Zone (for vibe context)</label>
            <select
              className="dialog-input"
              value={zoneKey}
              onChange={(e) => setSelectedZone(e.target.value)}
            >
              {zoneKeys.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        )}

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
            Create Asset
          </button>
        </div>
      </div>
    </div>
  );
}
