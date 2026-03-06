import { useCallback, useMemo, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { useGeneration } from "../../context/GenerationContext";
import { AbilityCell } from "./AbilityCell";
import { AbilityDetailPanel } from "./AbilityDetailPanel";
import { getAbilityFromEntity } from "../../lib/ability-parser";
import type { Entity } from "../../types/entities";
import type { AbilityConfig } from "../../types/abilities";
import type { ZoneData } from "../../types/project";

interface AbilityGridProps {
  zoneKey: string;
  zone: ZoneData;
  entities: Entity[];
  abilityConfig: AbilityConfig;
}

const CLASS_COLORS: Record<string, string> = {
  WARRIOR: "var(--color-gold)",
  MAGE: "var(--color-lavender)",
  CLERIC: "var(--color-pale-blue)",
  ROGUE: "var(--color-dusty-rose)",
};

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function AbilityGrid({ zoneKey, entities, abilityConfig }: AbilityGridProps) {
  const {
    selectEntity,
    selectedEntityId,
    getAsset,
    getImageDataUrl,
  } = useProject();
  const { settings } = useSettings();
  const {
    startPromptGeneration,
    startImageGeneration,
    getJob,
  } = useGeneration();

  const [activeClass, setActiveClass] = useState(abilityConfig.classes[0]);
  const [detailEntityId, setDetailEntityId] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);

  // Group entities by class
  const entitiesByClass = useMemo(() => {
    const groups: Record<string, Entity[]> = {};
    for (const cls of abilityConfig.classes) {
      groups[cls] = [];
    }
    for (const entity of entities) {
      const ability = getAbilityFromEntity(entity);
      if (groups[ability.requiredClass]) {
        groups[ability.requiredClass].push(entity);
      }
    }
    // Sort each class by level
    for (const cls of Object.keys(groups)) {
      groups[cls].sort((a, b) => {
        const aLvl = getAbilityFromEntity(a).levelRequired;
        const bLvl = getAbilityFromEntity(b).levelRequired;
        return aLvl - bLvl;
      });
    }
    return groups;
  }, [entities, abilityConfig.classes]);

  const visibleEntities = entitiesByClass[activeClass] || [];

  // Stats for active class
  const stats = useMemo(() => {
    const assets = visibleEntities.map((e) => getAsset(zoneKey, e.id));
    const total = assets.length;
    const generated = assets.filter((a) => a && a.variants.length > 0).length;
    const approved = assets.filter((a) => a?.status === "approved").length;
    return { total, generated, approved, pending: total - generated };
  }, [visibleEntities, zoneKey, getAsset]);

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

  // Batch generate prompts for all abilities in the active class that don't have one
  const handleBatchGeneratePrompts = useCallback(async () => {
    if (!settings.anthropicApiKey) return;
    setBatchGenerating(true);

    for (const entity of visibleEntities) {
      const asset = getAsset(zoneKey, entity.id);
      if (asset && !asset.currentPrompt) {
        startPromptGeneration(zoneKey, entity.id, entity, "");
      }
    }
    // Note: batch flag is cosmetic; individual jobs tracked by GenerationContext
    setBatchGenerating(false);
  }, [visibleEntities, zoneKey, getAsset, settings.anthropicApiKey, startPromptGeneration]);

  // Batch generate images for all abilities in the active class that have prompts but no images
  const handleBatchGenerateImages = useCallback(async () => {
    if (!settings.runwareApiKey) return;

    for (const entity of visibleEntities) {
      const asset = getAsset(zoneKey, entity.id);
      if (asset?.currentPrompt && asset.variants.length === 0) {
        startImageGeneration(zoneKey, entity.id, asset.currentPrompt, entity);
      }
    }
  }, [visibleEntities, zoneKey, getAsset, settings.runwareApiKey, startImageGeneration]);

  const promptsNeeded = visibleEntities.filter((e) => {
    const a = getAsset(zoneKey, e.id);
    return a && !a.currentPrompt;
  }).length;

  const imagesNeeded = visibleEntities.filter((e) => {
    const a = getAsset(zoneKey, e.id);
    return a?.currentPrompt && a.variants.length === 0;
  }).length;

  return (
    <div className="ability-grid-container">
      {/* Batch bar */}
      <div className="ability-batch-bar glass-panel">
        <div className="ability-batch-bar-title">Ability Icons</div>
        <div className="ability-batch-bar-stats">
          <span>{stats.total} abilities</span>
          {stats.approved > 0 && (
            <span className="ability-stat ability-stat--approved">{stats.approved} approved</span>
          )}
          {stats.generated > stats.approved && (
            <span className="ability-stat ability-stat--generated">{stats.generated - stats.approved} generated</span>
          )}
          {stats.pending > 0 && (
            <span className="ability-stat ability-stat--pending">{stats.pending} pending</span>
          )}
        </div>
        <div className="ability-batch-bar-actions">
          {promptsNeeded > 0 && (
            <button
              className="soft-button soft-button--small soft-button--primary"
              onClick={handleBatchGeneratePrompts}
              disabled={batchGenerating || !settings.anthropicApiKey}
              title={!settings.anthropicApiKey ? "Set Anthropic API key in Settings" : undefined}
            >
              Generate {promptsNeeded} Prompts
            </button>
          )}
          {imagesNeeded > 0 && (
            <button
              className="soft-button soft-button--small"
              onClick={handleBatchGenerateImages}
              disabled={!settings.runwareApiKey}
              title={!settings.runwareApiKey ? "Set Runware API key in Settings" : undefined}
            >
              Generate {imagesNeeded} Images
            </button>
          )}
        </div>
      </div>

      {/* Detail view */}
      {detailEntityId ? (
        <AbilityDetailPanel
          zoneKey={zoneKey}
          entityId={detailEntityId}
          onBack={handleBack}
        />
      ) : (
        <>
          {/* Class tabs */}
          <div className="ability-class-tabs">
            {abilityConfig.classes.map((cls) => (
              <button
                key={cls}
                className={`ability-class-tab${cls === activeClass ? " ability-class-tab--active" : ""}`}
                onClick={() => setActiveClass(cls)}
                style={cls === activeClass ? { borderBottomColor: CLASS_COLORS[cls] || "var(--color-lavender)" } : undefined}
              >
                {capitalize(cls)}
                <span className="ability-class-tab-count">
                  {(entitiesByClass[cls] || []).length}
                </span>
              </button>
            ))}
          </div>

          {/* Grid of ability cells */}
          <div className="ability-grid">
            {visibleEntities.map((entity) => {
              const ability = getAbilityFromEntity(entity);
              return (
                <AbilityCell
                  key={entity.id}
                  entityId={entity.id}
                  asset={getAsset(zoneKey, entity.id)}
                  label={ability.displayName}
                  level={ability.levelRequired}
                  selected={entity.id === selectedEntityId}
                  generating={!!getJob(zoneKey, entity.id)}
                  onClick={() => handleCellClick(entity.id)}
                  getDataUrl={getDataUrl}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
