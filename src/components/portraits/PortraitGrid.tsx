import { useCallback, useMemo, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useGeneration } from "../../context/GenerationContext";
import { parsePortraitId } from "../../lib/portrait-parser";
import { PortraitCell } from "./PortraitCell";
import { PortraitDetailPanel } from "./PortraitDetailPanel";
import { PortraitBatchBar } from "./PortraitBatchBar";
import type { Entity } from "../../types/entities";
import type { PortraitConfig } from "../../types/portraits";
import type { ZoneData } from "../../types/project";
import { RACE_DEFINITIONS, CLASS_DEFINITIONS, RACE_ORDER, CLASS_ORDER } from "../../types/sprites";

interface PortraitGridProps {
  zoneKey: string;
  zone: ZoneData;
  entities: Entity[];
  portraitConfig: PortraitConfig;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function raceLabel(race: string): string {
  return RACE_DEFINITIONS[race]?.displayName || capitalize(race);
}

function classLabel(cls: string): string {
  return CLASS_DEFINITIONS[cls]?.displayName || capitalize(cls);
}

/** Sort keys by a canonical order array, with unknowns at the end. */
function sortByOrder(keys: string[], order: string[]): string[] {
  const idx = (k: string) => {
    const i = order.indexOf(k);
    return i === -1 ? 9999 : i;
  };
  return [...keys].sort((a, b) => idx(a) - idx(b));
}

export function PortraitGrid({ zoneKey, zone, entities, portraitConfig }: PortraitGridProps) {
  const {
    selectEntity,
    selectedEntityId,
    getAsset,
    getImageDataUrl,
    updatePortraitTemplate,
  } = useProject();
  const { getJob } = useGeneration();

  const [detailEntityId, setDetailEntityId] = useState<string | null>(null);

  const mobs = useMemo(
    () => entities.filter((e) => e.type === "mob"),
    [entities]
  );

  // Split into race and class portraits
  const raceEntities = useMemo(() => {
    const sorted = sortByOrder(portraitConfig.races, RACE_ORDER);
    return sorted
      .map((race) => mobs.find((e) => parsePortraitId(e.id)?.key === race && parsePortraitId(e.id)?.portraitType === "race"))
      .filter(Boolean) as Entity[];
  }, [mobs, portraitConfig.races]);

  const classEntities = useMemo(() => {
    const sorted = sortByOrder(portraitConfig.classes, CLASS_ORDER);
    return sorted
      .map((cls) => mobs.find((e) => parsePortraitId(e.id)?.key === cls && parsePortraitId(e.id)?.portraitType === "class"))
      .filter(Boolean) as Entity[];
  }, [mobs, portraitConfig.classes]);

  const handleCellClick = useCallback(
    (entityId: string) => {
      selectEntity(zoneKey, entityId);
      setDetailEntityId(entityId);
    },
    [zoneKey, selectEntity]
  );

  const handleBack = useCallback(() => {
    setDetailEntityId(null);
  }, []);

  const getDataUrl = useCallback(
    async (entityId: string, filename: string) => {
      return getImageDataUrl(zoneKey, entityId, filename);
    },
    [zoneKey, getImageDataUrl]
  );

  const handleTemplateGenerated = useCallback(
    async (template: import("../../types/portraits").PortraitPromptTemplate) => {
      await updatePortraitTemplate(zoneKey, template);
    },
    [zoneKey, updatePortraitTemplate]
  );

  return (
    <div className="sprite-grid-container">
      <PortraitBatchBar
        zoneKey={zoneKey}
        portraitConfig={portraitConfig}
        portraitTemplate={zone.portraitTemplate || null}
        zoneVibe={zone.vibe}
        entities={entities}
        onTemplateGenerated={handleTemplateGenerated}
      />

      {/* Detail view */}
      {detailEntityId ? (
        <PortraitDetailPanel
          zoneKey={zoneKey}
          entityId={detailEntityId}
          portraitTemplate={zone.portraitTemplate || null}
          onBack={handleBack}
        />
      ) : (
        <div className="portrait-grid-sections">
          {/* Race Portraits */}
          <div className="portrait-section">
            <h3 className="portrait-section-title">Race Portraits</h3>
            <div className="portrait-row">
              {raceEntities.map((entity) => {
                const dims = parsePortraitId(entity.id);
                return (
                  <PortraitCell
                    key={entity.id}
                    entityId={entity.id}
                    asset={getAsset(zoneKey, entity.id)}
                    label={dims ? raceLabel(dims.key) : entity.title}
                    selected={entity.id === selectedEntityId}
                    generating={!!getJob(zoneKey, entity.id)}
                    onClick={() => handleCellClick(entity.id)}
                    getDataUrl={getDataUrl}
                  />
                );
              })}
            </div>
          </div>

          {/* Class Portraits */}
          <div className="portrait-section">
            <h3 className="portrait-section-title">Class Portraits</h3>
            <div className="portrait-row">
              {classEntities.map((entity) => {
                const dims = parsePortraitId(entity.id);
                return (
                  <PortraitCell
                    key={entity.id}
                    entityId={entity.id}
                    asset={getAsset(zoneKey, entity.id)}
                    label={dims ? classLabel(dims.key) : entity.title}
                    selected={entity.id === selectedEntityId}
                    generating={!!getJob(zoneKey, entity.id)}
                    onClick={() => handleCellClick(entity.id)}
                    getDataUrl={getDataUrl}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
