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

const STATUS_EFFECTS_TAB = "__STATUS_EFFECTS__";

const CLASS_COLORS: Record<string, string> = {
  WARRIOR: "var(--color-gold)",
  MAGE: "var(--color-lavender)",
  CLERIC: "var(--color-pale-blue)",
  ROGUE: "var(--color-dusty-rose)",
  [STATUS_EFFECTS_TAB]: "var(--color-moss-green)",
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

  const [activeTab, setActiveTab] = useState(abilityConfig.classes[0]);
  const [detailEntityId, setDetailEntityId] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);

  // Split entities: abilities (have requiredClass) vs status effects
  const { abilityEntities, statusEffectEntities } = useMemo(() => {
    const abilities: Entity[] = [];
    const statusEffects: Entity[] = [];
    for (const entity of entities) {
      if (entity.id.startsWith("statusEffects:")) {
        statusEffects.push(entity);
      } else {
        abilities.push(entity);
      }
    }
    return { abilityEntities: abilities, statusEffectEntities: statusEffects };
  }, [entities]);

  // Group ability entities by class
  const entitiesByClass = useMemo(() => {
    const groups: Record<string, Entity[]> = {};
    for (const cls of abilityConfig.classes) {
      groups[cls] = [];
    }
    for (const entity of abilityEntities) {
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
  }, [abilityEntities, abilityConfig.classes]);

  const hasStatusEffects = statusEffectEntities.length > 0;
  const tabs = hasStatusEffects
    ? [...abilityConfig.classes, STATUS_EFFECTS_TAB]
    : abilityConfig.classes;

  const visibleEntities =
    activeTab === STATUS_EFFECTS_TAB
      ? statusEffectEntities
      : entitiesByClass[activeTab] || [];

  // Stats for active tab
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

  // Batch generate prompts for all visible entities that don't have one
  const handleBatchGeneratePrompts = useCallback(async () => {
    if (!settings.anthropicApiKey) return;
    setBatchGenerating(true);

    for (const entity of visibleEntities) {
      const asset = getAsset(zoneKey, entity.id);
      if (asset && !asset.currentPrompt) {
        startPromptGeneration(zoneKey, entity.id, entity, "");
      }
    }
    setBatchGenerating(false);
  }, [visibleEntities, zoneKey, getAsset, settings.anthropicApiKey, startPromptGeneration]);

  // Batch generate images for all visible entities that have prompts but no images
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

  const tabLabel =
    activeTab === STATUS_EFFECTS_TAB ? "Status Effects" : `${capitalize(activeTab)} Abilities`;

  return (
    <div className="ability-grid-container">
      {/* Batch bar */}
      <div className="ability-batch-bar glass-panel">
        <div className="ability-batch-bar-title">{tabLabel}</div>
        <div className="ability-batch-bar-stats">
          <span>{stats.total} icons</span>
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
          {/* Class + status effect tabs */}
          <div className="ability-class-tabs">
            {tabs.map((tab) => {
              const isStatusTab = tab === STATUS_EFFECTS_TAB;
              const label = isStatusTab ? "Status Effects" : capitalize(tab);
              const count = isStatusTab
                ? statusEffectEntities.length
                : (entitiesByClass[tab] || []).length;

              return (
                <button
                  key={tab}
                  className={`ability-class-tab${tab === activeTab ? " ability-class-tab--active" : ""}`}
                  onClick={() => setActiveTab(tab)}
                  style={tab === activeTab ? { borderBottomColor: CLASS_COLORS[tab] || "var(--color-lavender)" } : undefined}
                >
                  {label}
                  <span className="ability-class-tab-count">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Grid of cells */}
          <div className="ability-grid">
            {visibleEntities.map((entity) => {
              const raw = entity.rawYaml as Record<string, unknown>;
              const label = (raw.displayName as string) || entity.title;
              const level = (raw.levelRequired as number) ?? 0;

              return (
                <AbilityCell
                  key={entity.id}
                  entityId={entity.id}
                  asset={getAsset(zoneKey, entity.id)}
                  label={label}
                  level={level}
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
