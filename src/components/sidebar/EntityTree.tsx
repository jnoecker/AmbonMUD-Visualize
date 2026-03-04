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
    </div>
  );
}
