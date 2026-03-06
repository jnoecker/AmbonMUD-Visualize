import { useProject } from "../../context/ProjectContext";
import { EntityTree } from "./EntityTree";
import { ZoneVibePanel } from "./ZoneVibePanel";
import { ZoneMusicPanel } from "../music/ZoneMusicPanel";
import type { ZoneData } from "../../types/project";

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

        return (
          <div key={zoneKey}>
            <div className="glass-panel" style={{ marginBottom: "var(--space-3)" }}>
              <div className="glass-panel-header">
                <span className="glass-panel-title">
                  {isBlankZone ? "Custom Assets" : zone.zoneName}
                </span>
              </div>
              {isSpriteZone ? (
                <SpriteSummary
                  zone={zone}
                  selected={selectedZone === zoneKey}
                  onSelect={() => selectEntity(zoneKey, "")}
                />
              ) : isAbilityZone ? (
                <AbilitySummary
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
                />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

function SpriteSummary({
  zone,
  selected,
  onSelect,
}: {
  zone: ZoneData;
  selected: boolean;
  onSelect: () => void;
}) {
  const assets = Object.values(zone.assets);
  const mobs = assets.filter((a) => a.entityType === "mob");
  const approved = mobs.filter((a) => a.status === "approved").length;
  const generated = mobs.filter((a) => a.status === "generated" || a.status === "approved").length;

  return (
    <div
      className={`sprite-summary${selected ? " sprite-summary--selected" : ""}`}
      onClick={onSelect}
    >
      <div className="sprite-summary-label">
        Player Sprites
        <span className="sprite-summary-count">{mobs.length}</span>
      </div>
      <div className="sprite-summary-stats">
        {approved > 0 && (
          <span className="sprite-summary-stat sprite-summary-stat--approved">
            {approved} approved
          </span>
        )}
        {generated > approved && (
          <span className="sprite-summary-stat sprite-summary-stat--generated">
            {generated - approved} generated
          </span>
        )}
        {mobs.length - generated > 0 && (
          <span className="sprite-summary-stat sprite-summary-stat--pending">
            {mobs.length - generated} pending
          </span>
        )}
      </div>
      {zone.spriteTemplate && (
        <div className="sprite-summary-template">Template ready</div>
      )}
    </div>
  );
}

function AbilitySummary({
  zone,
  selected,
  onSelect,
}: {
  zone: ZoneData;
  selected: boolean;
  onSelect: () => void;
}) {
  const assets = Object.values(zone.assets);
  const abilities = assets.filter((a) => a.entityType === "ability");
  const approved = abilities.filter((a) => a.status === "approved").length;
  const generated = abilities.filter((a) => a.status === "generated" || a.status === "approved").length;

  return (
    <div
      className={`sprite-summary${selected ? " sprite-summary--selected" : ""}`}
      onClick={onSelect}
    >
      <div className="sprite-summary-label">
        Ability Icons
        <span className="sprite-summary-count">{abilities.length}</span>
      </div>
      <div className="sprite-summary-stats">
        {approved > 0 && (
          <span className="sprite-summary-stat sprite-summary-stat--approved">
            {approved} approved
          </span>
        )}
        {generated > approved && (
          <span className="sprite-summary-stat sprite-summary-stat--generated">
            {generated - approved} generated
          </span>
        )}
        {abilities.length - generated > 0 && (
          <span className="sprite-summary-stat sprite-summary-stat--pending">
            {abilities.length - generated} pending
          </span>
        )}
      </div>
    </div>
  );
}
