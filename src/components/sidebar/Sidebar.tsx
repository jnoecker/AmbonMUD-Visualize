import { useProject } from "../../context/ProjectContext";
import { EntityTree } from "./EntityTree";
import { ZoneVibePanel } from "./ZoneVibePanel";

export function Sidebar() {
  const { project, parsedZones, selectedEntityId, selectedZone, selectEntity } = useProject();

  if (!project) return null;

  const zoneKeys = Object.keys(project.zones);

  return (
    <>
      {zoneKeys.map((zoneKey) => {
        const zone = project.zones[zoneKey];
        const parsed = parsedZones[zoneKey];
        if (!parsed) return null;

        return (
          <div key={zoneKey}>
            <div className="glass-panel" style={{ marginBottom: "var(--space-3)" }}>
              <div className="glass-panel-header">
                <span className="glass-panel-title">{zone.zoneName}</span>
              </div>
              <EntityTree
                zoneKey={zoneKey}
                entities={parsed.entities}
                assets={zone.assets}
                selectedEntityId={selectedZone === zoneKey ? selectedEntityId : null}
                onSelectEntity={(entityId) => selectEntity(zoneKey, entityId)}
              />
            </div>
            <ZoneVibePanel
              zoneName={zone.zoneName}
              vibe={zone.vibe}
              defaultImages={zone.defaultImages}
              allRoomDescriptions={parsed.allRoomDescriptions}
            />
          </div>
        );
      })}
    </>
  );
}
