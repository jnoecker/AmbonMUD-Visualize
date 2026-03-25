import { useProject } from "../../context/ProjectContext";
import { EntityTree } from "./EntityTree";
import { ZoneVibePanel } from "./ZoneVibePanel";
import { ZoneMusicPanel } from "../music/ZoneMusicPanel";
import { ZoneVideoPanel } from "../video/ZoneVideoPanel";
import { EntitySummary } from "../shared/EntitySummary";

export function Sidebar() {
  const { project, parsedZones, selectedEntityId, selectedZone, selectEntity } = useProject();

  if (!project) return null;

  const zoneKeys = Object.keys(project.zones);

  return (
    <>
      {zoneKeys.map((zoneKey) => {
        const zone = project.zones[zoneKey];
        const parsed = parsedZones[zoneKey];
        const isBlankZone = !zone.sourceYamlPath;

        const isSpriteZone = !!zone.spriteConfig;

        // For blank zones (no YAML source), show the entity tree with custom assets only
        const entities = parsed?.entities ?? [];

        // Skip non-blank zones that haven't been parsed yet
        if (!parsed && !isBlankZone) return null;

        const isAbilityZone = !!zone.abilityConfig;
        const isPortraitZone = !!zone.portraitConfig;

        return (
          <div key={zoneKey} className="sidebar-zone">
            <div className="glass-panel">
              <div className="glass-panel-header">
                <span className="glass-panel-title">
                  {isBlankZone ? "Custom Assets" : zone.zoneName}
                </span>
              </div>
              {isSpriteZone ? (
                <EntitySummary
                  label="Player Sprites"
                  entityType="mob"
                  zone={zone}
                  selected={selectedZone === zoneKey}
                  onSelect={() => selectEntity(zoneKey, "")}
                  templateReady={!!zone.spriteTemplate}
                />
              ) : isPortraitZone ? (
                <EntitySummary
                  label="Character Portraits"
                  entityType="mob"
                  zone={zone}
                  selected={selectedZone === zoneKey}
                  onSelect={() => selectEntity(zoneKey, "")}
                  templateReady={!!zone.portraitTemplate}
                />
              ) : isAbilityZone ? (
                <EntitySummary
                  label="Ability Icons"
                  entityType="ability"
                  zone={zone}
                  selected={selectedZone === zoneKey}
                  onSelect={() => selectEntity(zoneKey, "")}
                />
              ) : (
                <EntityTree
                  zoneKey={zoneKey}
                  entities={entities}
                  assets={zone.assets}
                  selectedEntityId={selectedZone === zoneKey ? selectedEntityId : null}
                  onSelectEntity={(entityId) => selectEntity(zoneKey, entityId)}
                />
              )}
            </div>
            {!isBlankZone && !isAbilityZone && (
              <>
                <ZoneVibePanel
                  zoneName={zone.zoneName}
                  vibe={zone.vibe}
                  defaultImages={zone.defaultImages}
                  allRoomDescriptions={parsed?.allRoomDescriptions ?? ""}
                />
                <ZoneMusicPanel
                  zoneKey={zoneKey}
                  zoneName={zone.zoneName}
                  vibe={zone.vibe}
                  roomDescriptions={parsed?.allRoomDescriptions ?? []}
                  roomIds={parsed?.entities.filter((e) => e.type === "room").map((e) => e.bareId)}
                />
                <ZoneVideoPanel
                  zoneKey={zoneKey}
                  zoneName={zone.zoneName}
                  vibe={zone.vibe}
                  entities={entities}
                />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

