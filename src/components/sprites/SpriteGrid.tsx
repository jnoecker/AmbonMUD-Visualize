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
import {
  TIER_DEFINITIONS,
  RACE_DEFINITIONS,
  CLASS_DEFINITIONS,
  TIER_ORDER,
  RACE_ORDER,
  CLASS_ORDER,
} from "../../types/sprites";

interface SpriteGridProps {
  zoneKey: string;
  zone: ZoneData;
  entities: Entity[];
  spriteConfig: SpriteConfig;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function raceLabel(race: string): string {
  return RACE_DEFINITIONS[race]?.displayName || capitalize(race);
}

function classLabel(cls: string): string {
  if (cls === "base") return "Base";
  return CLASS_DEFINITIONS[cls]?.displayName || capitalize(cls);
}

function tierLabel(tier: string): string {
  return TIER_DEFINITIONS[tier]?.displayName || tier;
}

function tierLevelLabel(tier: string): string {
  const def = TIER_DEFINITIONS[tier];
  return def?.levels || "";
}

/** Sort keys by a canonical order array, with unknowns at the end. */
function sortByOrder(keys: string[], order: string[]): string[] {
  const idx = (k: string) => {
    const i = order.indexOf(k);
    return i === -1 ? 9999 : i;
  };
  return [...keys].sort((a, b) => idx(a) - idx(b));
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

  const [activeClass, setActiveClass] = useState(
    sortByOrder(spriteConfig.classes, CLASS_ORDER)[0]
  );
  const [detailEntityId, setDetailEntityId] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null);

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

  // Sort races and tiers by canonical order
  const sortedRaces = useMemo(
    () => sortByOrder(spriteConfig.races, RACE_ORDER),
    [spriteConfig.races]
  );
  const sortedTiers = useMemo(
    () => sortByOrder(spriteConfig.tiers, TIER_ORDER),
    [spriteConfig.tiers]
  );
  const sortedClasses = useMemo(
    () => sortByOrder(spriteConfig.classes, CLASS_ORDER),
    [spriteConfig.classes]
  );

  // Filter groups for active class
  const visibleGroups = useMemo(
    () => {
      const filtered = groups.filter((g) => g.playerClass === activeClass);
      // Sort by canonical race order
      return filtered.sort(
        (a, b) => sortedRaces.indexOf(a.race) - sortedRaces.indexOf(b.race)
      );
    },
    [groups, activeClass, sortedRaces]
  );

  // Entity IDs visible in current class tab
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

      {/* Class tabs */}
      <div className="sprite-class-tabs">
        {sortedClasses.map((cls) => (
          <button
            key={cls}
            className={`sprite-class-tab${cls === activeClass ? " sprite-class-tab--active" : ""}`}
            onClick={() => setActiveClass(cls)}
          >
            {classLabel(cls)}
            <span className="sprite-class-tab-count">
              {groups
                .filter((g) => g.playerClass === cls)
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
          {sortedTiers.flatMap((tier, tierIdx) => {
            const header = (
              <div key={tier} className="sprite-grid-col-header">
                {tierLabel(tier)}
                {tierLevelLabel(tier) && (
                  <span className="sprite-grid-col-level">{tierLevelLabel(tier)}</span>
                )}
              </div>
            );
            return tierIdx > 0
              ? [<div key={`spacer-${tier}`} className="sprite-swap-spacer" />, header]
              : [header];
          })}
        </div>

        {/* Rows */}
        {visibleGroups.map((group) => (
          <div key={`${group.race}-${group.playerClass}`} className="sprite-grid-row">
            <div className="sprite-grid-row-header">
              {raceLabel(group.race)}
            </div>
            {sortedTiers.flatMap((tier, tierIdx) => {
              const entityId = group.entityIds[tier];
              const prevTier = tierIdx > 0 ? sortedTiers[tierIdx - 1] : undefined;
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
                  title={`Swap ${tierLabel(prevTier!)} ↔ ${tierLabel(tier)}`}
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
