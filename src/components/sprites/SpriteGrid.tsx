import { useCallback, useMemo, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useGeneration } from "../../context/GenerationContext";
import { groupSprites } from "../../lib/sprite-parser";
import { SpriteCell } from "./SpriteCell";
import { SpriteDetailPanel } from "./SpriteDetailPanel";
import { SpriteBatchBar } from "./SpriteBatchBar";
import type { Entity } from "../../types/entities";
import type { SpriteConfig, SpritePromptTemplate } from "../../types/sprites";
import type { ZoneData } from "../../types/project";

interface SpriteGridProps {
  zoneKey: string;
  zone: ZoneData;
  entities: Entity[];
  spriteConfig: SpriteConfig;
}

const TIER_LABELS: Record<number, string> = {
  1: "Novice",
  10: "Apprentice",
  20: "Journeyman",
  30: "Expert",
  40: "Master",
  50: "Legendary",
  60: "Staff",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  enby: "Nonbinary",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function SpriteGrid({ zoneKey, zone, entities, spriteConfig }: SpriteGridProps) {
  const {
    selectEntity,
    selectedEntityId,
    getAsset,
    getImageDataUrl,
    updateSpriteTemplate,
    swapVariants,
  } = useProject();
  const { getJob } = useGeneration();

  const [activeGender, setActiveGender] = useState(spriteConfig.genders[0]);
  const [activeClass, setActiveClass] = useState(spriteConfig.classes[0]);
  const [detailEntityId, setDetailEntityId] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null); // "entityA|entityB"

  const handleSwap = useCallback(
    async (entityIdA: string, entityIdB: string) => {
      const key = `${entityIdA}|${entityIdB}`;
      setSwapping(key);
      try {
        await swapVariants(zoneKey, entityIdA, entityIdB);
      } finally {
        setSwapping(null);
      }
    },
    [zoneKey, swapVariants]
  );

  // Memoize groups
  const groups = useMemo(
    () => groupSprites(entities, spriteConfig),
    [entities, spriteConfig]
  );

  // Filter groups for active gender + class
  const visibleGroups = useMemo(
    () => groups.filter((g) => g.gender === activeGender && g.playerClass === activeClass),
    [groups, activeGender, activeClass]
  );

  // Entity IDs visible in current gender + class tab
  const visibleEntityIds = useMemo(
    () => visibleGroups.flatMap((g) => Object.values(g.entityIds)),
    [visibleGroups]
  );

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
    async (template: SpritePromptTemplate) => {
      await updateSpriteTemplate(zoneKey, template);
    },
    [zoneKey, updateSpriteTemplate]
  );

  return (
    <div className="sprite-grid-container">
      <SpriteBatchBar
        zoneKey={zoneKey}
        spriteConfig={spriteConfig}
        spriteTemplate={zone.spriteTemplate || null}
        zoneVibe={zone.vibe}
        entities={entities}
        visibleEntityIds={visibleEntityIds}
        onTemplateGenerated={handleTemplateGenerated}
      />

      {/* Detail view (shown instead of grid, batch bar stays visible above) */}
      {detailEntityId ? (
        <SpriteDetailPanel
          zoneKey={zoneKey}
          entityId={detailEntityId}
          spriteTemplate={zone.spriteTemplate || null}
          onBack={handleBack}
        />
      ) : (<>

      {/* Gender tabs */}
      <div className="sprite-gender-tabs">
        {spriteConfig.genders.map((gender) => (
          <button
            key={gender}
            className={`sprite-gender-tab${gender === activeGender ? " sprite-gender-tab--active" : ""}`}
            onClick={() => setActiveGender(gender)}
          >
            {GENDER_LABELS[gender] || capitalize(gender)}
          </button>
        ))}
      </div>

      {/* Class tabs */}
      <div className="sprite-class-tabs">
        {spriteConfig.classes.map((cls) => (
          <button
            key={cls}
            className={`sprite-class-tab${cls === activeClass ? " sprite-class-tab--active" : ""}`}
            onClick={() => setActiveClass(cls)}
          >
            {capitalize(cls)}
            <span className="sprite-class-tab-count">
              {groups
                .filter((g) => g.gender === activeGender && g.playerClass === cls)
                .reduce((n, g) => n + Object.keys(g.entityIds).length, 0)}
            </span>
          </button>
        ))}
      </div>

      {/* Grid: rows = races, columns = tiers */}
      <div className="sprite-grid">
        {/* Column headers */}
        <div className="sprite-grid-header">
          <div className="sprite-grid-corner" />
          {spriteConfig.tiers.flatMap((tier, tierIdx) => {
            const header = (
              <div key={tier} className="sprite-grid-col-header">
                {TIER_LABELS[tier] || `L${tier}`}
                <span className="sprite-grid-col-level">Lv {tier}</span>
              </div>
            );
            return tierIdx > 0
              ? [<div key={`spacer-${tier}`} className="sprite-swap-spacer" />, header]
              : [header];
          })}
        </div>

        {/* Rows */}
        {visibleGroups.map((group) => (
          <div key={`${group.race}-${group.gender}-${group.playerClass}`} className="sprite-grid-row">
            <div className="sprite-grid-row-header">
              {capitalize(group.race)}
            </div>
            {spriteConfig.tiers.flatMap((tier, tierIdx) => {
              const entityId = group.entityIds[tier];
              const prevTier = tierIdx > 0 ? spriteConfig.tiers[tierIdx - 1] : undefined;
              const prevEntityId = prevTier ? group.entityIds[prevTier] : undefined;

              const cell = !entityId ? (
                <div key={tier} className="sprite-cell sprite-cell--missing" />
              ) : (
                <SpriteCell
                  key={tier}
                  entityId={entityId}
                  asset={getAsset(zoneKey, entityId)}
                  race={group.race}
                  selected={entityId === selectedEntityId}
                  generating={!!getJob(zoneKey, entityId)}
                  onClick={() => handleCellClick(entityId)}
                  getDataUrl={getDataUrl}
                />
              );

              if (tierIdx === 0) return [cell];

              // Swap button or spacer between adjacent tiers
              const gap = prevEntityId && entityId ? (
                <button
                  key={`swap-${tier}`}
                  className="sprite-swap-btn"
                  title={`Swap L${prevTier} ↔ L${tier}`}
                  disabled={swapping !== null}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSwap(prevEntityId, entityId);
                  }}
                >
                  ⇄
                </button>
              ) : (
                <div key={`spacer-${tier}`} className="sprite-swap-spacer" />
              );

              return [gap, cell];
            })}
          </div>
        ))}
      </div>
      </>)}
    </div>
  );
}
