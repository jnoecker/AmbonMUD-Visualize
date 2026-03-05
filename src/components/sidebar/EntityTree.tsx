import { useState } from "react";
import { EntityTreeItem } from "./EntityTreeItem";
import { useGeneration } from "../../context/GenerationContext";
import type { Entity, EntityType } from "../../types/entities";
import type { AssetEntry } from "../../types/project";

interface EntityTreeProps {
  zoneKey: string;
  entities: Entity[];
  assets: Record<string, AssetEntry>;
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
}

const SECTIONS: { type: EntityType; label: string }[] = [
  { type: "room", label: "Rooms" },
  { type: "mob", label: "Mobs" },
  { type: "item", label: "Items" },
];

function TreeSection({
  label,
  zoneKey,
  entities,
  assets,
  selectedEntityId,
  onSelectEntity,
}: {
  label: string;
  zoneKey: string;
  entities: Entity[];
  assets: Record<string, AssetEntry>;
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const { getJob } = useGeneration();

  return (
    <div className="entity-tree-section">
      <div className="entity-tree-header" onClick={() => setOpen(!open)}>
        <span className={`entity-tree-header-arrow${open ? " entity-tree-header-arrow--open" : ""}`}>
          &#9654;
        </span>
        <span>{label}</span>
        <span className="entity-tree-header-count">{entities.length}</span>
      </div>
      {open && (
        <ul className="entity-tree-list">
          {entities.map((entity) => {
            const asset = assets[entity.id];
            return (
              <EntityTreeItem
                key={entity.id}
                title={entity.title}
                status={asset?.status ?? "pending"}
                selected={entity.id === selectedEntityId}
                generating={!!getJob(zoneKey, entity.id)}
                onClick={() => onSelectEntity(entity.id)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function EntityTree({ zoneKey, entities, assets, selectedEntityId, onSelectEntity }: EntityTreeProps) {
  const customAssets = Object.values(assets).filter((a) => a.customDescription);

  return (
    <div>
      {SECTIONS.map(({ type, label }) => {
        const filtered = entities.filter((e) => e.type === type);
        if (filtered.length === 0) return null;
        return (
          <TreeSection
            key={type}
            label={label}
            zoneKey={zoneKey}
            entities={filtered}
            assets={assets}
            selectedEntityId={selectedEntityId}
            onSelectEntity={onSelectEntity}
          />
        );
      })}
      {customAssets.length > 0 && (
        <CustomSection
          zoneKey={zoneKey}
          customAssets={customAssets}
          selectedEntityId={selectedEntityId}
          onSelectEntity={onSelectEntity}
        />
      )}
    </div>
  );
}

function CustomSection({
  zoneKey,
  customAssets,
  selectedEntityId,
  onSelectEntity,
}: {
  zoneKey: string;
  customAssets: AssetEntry[];
  selectedEntityId: string | null;
  onSelectEntity: (entityId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const { getJob } = useGeneration();

  return (
    <div className="entity-tree-section">
      <div className="entity-tree-header" onClick={() => setOpen(!open)}>
        <span className={`entity-tree-header-arrow${open ? " entity-tree-header-arrow--open" : ""}`}>
          &#9654;
        </span>
        <span>Custom</span>
        <span className="entity-tree-header-count">{customAssets.length}</span>
      </div>
      {open && (
        <ul className="entity-tree-list">
          {customAssets.map((asset) => (
            <EntityTreeItem
              key={asset.entityId}
              title={asset.title}
              status={asset.status}
              selected={asset.entityId === selectedEntityId}
              generating={!!getJob(zoneKey, asset.entityId)}
              onClick={() => onSelectEntity(asset.entityId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
