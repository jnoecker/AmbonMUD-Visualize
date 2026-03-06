import type { Entity } from "../types/entities";
import type { EntityEdits } from "../types/project";

/**
 * Apply user edits onto a parsed Entity, returning a new Entity with
 * updated display fields (title, description, extraContext) and merged rawYaml.
 */
export function applyEditsToEntity(
  entity: Entity,
  edits: EntityEdits | undefined
): Entity {
  if (!edits || Object.keys(edits).length === 0) return entity;

  const merged = { ...entity.rawYaml, ...edits };
  const updated = { ...entity, rawYaml: merged };

  // Update display fields based on entity type + edited values
  if (entity.type === "room") {
    if ("title" in edits) updated.title = String(edits.title);
    if ("description" in edits) updated.description = String(edits.description);
    updated.extraContext = buildRoomExtraContext(merged);
  } else if (entity.type === "mob") {
    if ("name" in edits) {
      updated.title = String(edits.name);
      updated.description = String(edits.name);
    }
    updated.extraContext = buildMobExtraContext(merged);
  } else if (entity.type === "item") {
    if ("displayName" in edits) updated.title = String(edits.displayName);
    if ("description" in edits) updated.description = String(edits.description);
    else if ("displayName" in edits) updated.description = String(edits.displayName);
    updated.extraContext = buildItemExtraContext(merged);
  }

  return updated;
}

function buildRoomExtraContext(raw: Record<string, unknown>): string {
  const exits = raw.exits as Record<string, unknown> | undefined;
  const exitDirs = exits ? Object.keys(exits).join(", ") : "none";
  return [`Exits: ${exitDirs}`].filter(Boolean).join("\n");
}

function buildMobExtraContext(raw: Record<string, unknown>): string {
  const tier = raw.tier ?? "standard";
  const level = raw.level as number | undefined;
  const behavior = raw.behavior as { template?: string } | undefined;
  const aggroMessages = raw.aggroMessages as string[] | undefined;

  return [
    `Tier: ${tier}`,
    level ? `Level: ${level}` : null,
    behavior?.template ? `Behavior: ${behavior.template}` : null,
    raw.room ? `Found in: ${raw.room}` : null,
    aggroMessages?.length ? `Aggro: "${aggroMessages[0]}"` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildItemExtraContext(raw: Record<string, unknown>): string {
  return [
    raw.slot ? `Slot: ${raw.slot}` : null,
    raw.damage ? `Damage: ${raw.damage}` : null,
    raw.armor ? `Armor: ${raw.armor}` : null,
    raw.consumable ? "Consumable" : null,
    raw.basePrice ? `Price: ${raw.basePrice}g` : null,
    raw.room ? `Location: ${raw.room}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
