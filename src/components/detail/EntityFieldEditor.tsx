import { useCallback, useEffect, useRef, useState } from "react";
import type { Entity, EntityType } from "../../types/entities";
import { useProject } from "../../context/ProjectContext";

interface Props {
  entity: Entity;
  zoneKey: string;
  disabled?: boolean;
}

/** Field definition for the editor UI. */
interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select";
  options?: string[];
}

const ROOM_FIELDS: FieldDef[] = [
  { key: "title", label: "Title", type: "text" },
  { key: "description", label: "Description", type: "textarea" },
];

const MOB_FIELDS: FieldDef[] = [
  { key: "name", label: "Name", type: "text" },
  { key: "tier", label: "Tier", type: "select", options: ["weak", "standard", "elite", "boss"] },
  { key: "level", label: "Level", type: "number" },
  { key: "hp", label: "HP Override", type: "number" },
  { key: "minDamage", label: "Min Damage", type: "number" },
  { key: "maxDamage", label: "Max Damage", type: "number" },
  { key: "armor", label: "Armor", type: "number" },
  { key: "xpReward", label: "XP Reward", type: "number" },
  { key: "goldMin", label: "Gold Min", type: "number" },
  { key: "goldMax", label: "Gold Max", type: "number" },
  { key: "respawnSeconds", label: "Respawn (sec)", type: "number" },
];

const ITEM_FIELDS: FieldDef[] = [
  { key: "displayName", label: "Display Name", type: "text" },
  { key: "description", label: "Description", type: "textarea" },
  { key: "keyword", label: "Keyword", type: "text" },
  { key: "slot", label: "Slot", type: "select", options: ["", "head", "body", "hand"] },
  { key: "damage", label: "Damage", type: "number" },
  { key: "armor", label: "Armor", type: "number" },
  { key: "constitution", label: "Constitution", type: "number" },
  { key: "basePrice", label: "Price", type: "number" },
];

const ABILITY_FIELDS: FieldDef[] = [
  { key: "displayName", label: "Display Name", type: "text" },
  { key: "description", label: "Description", type: "textarea" },
];

const FIELDS_BY_TYPE: Record<EntityType, FieldDef[]> = {
  room: ROOM_FIELDS,
  mob: MOB_FIELDS,
  item: ITEM_FIELDS,
  ability: ABILITY_FIELDS,
};

export function EntityFieldEditor({ entity, zoneKey, disabled }: Props) {
  const { updateEntityField } = useProject();
  const fields = FIELDS_BY_TYPE[entity.type];

  return (
    <div className="entity-field-editor">
      {fields.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={entity.rawYaml[field.key]}
          disabled={disabled}
          onChange={(value) => updateEntityField(zoneKey, entity.id, field.key, value)}
        />
      ))}
    </div>
  );
}

interface FieldInputProps {
  field: FieldDef;
  value: unknown;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}

function FieldInput({ field, value, disabled, onChange }: FieldInputProps) {
  const displayValue = value == null ? "" : String(value);
  const [localValue, setLocalValue] = useState(displayValue);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Sync local state when entity changes
  useEffect(() => {
    setLocalValue(value == null ? "" : String(value));
  }, [value]);

  const handleChange = useCallback(
    (raw: string) => {
      setLocalValue(raw);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (field.type === "number") {
          const num = Number(raw);
          onChange(raw === "" ? undefined : isNaN(num) ? undefined : num);
        } else {
          onChange(raw === "" ? undefined : raw);
        }
      }, 400);
    },
    [field.type, onChange]
  );

  // Cleanup on unmount
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  if (field.type === "textarea") {
    return (
      <label className="entity-field">
        <span className="entity-field-label">{field.label}</span>
        <textarea
          className="entity-field-input entity-field-textarea"
          value={localValue}
          disabled={disabled}
          rows={3}
          onChange={(e) => handleChange(e.target.value)}
        />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="entity-field">
        <span className="entity-field-label">{field.label}</span>
        <select
          className="entity-field-input entity-field-select"
          value={localValue}
          disabled={disabled}
          onChange={(e) => {
            setLocalValue(e.target.value);
            onChange(e.target.value === "" ? undefined : e.target.value);
          }}
        >
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt || "(none)"}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <label className="entity-field">
      <span className="entity-field-label">{field.label}</span>
      <input
        className="entity-field-input"
        type={field.type === "number" ? "number" : "text"}
        value={localValue}
        disabled={disabled}
        onChange={(e) => handleChange(e.target.value)}
      />
    </label>
  );
}
