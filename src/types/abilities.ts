export interface AbilityEffect {
  type: string;
  [key: string]: unknown;
}

export interface AbilityDefinition {
  displayName: string;
  description: string;
  manaCost: number;
  cooldownMs: number;
  levelRequired: number;
  targetType: string;
  requiredClass: string;
  effect: AbilityEffect;
}

export interface StatusEffectDefinition {
  displayName: string;
  effectType: string;
  durationMs?: number;
  tickIntervalMs?: number;
  tickMinValue?: number;
  tickMaxValue?: number;
  shieldAmount?: number;
  stackBehavior?: string;
  maxStacks?: number;
  [key: string]: unknown;
}

export interface AbilityConfig {
  classes: string[];
  targetTypes: string[];
  effectTypes: string[];
  /** Races extracted from application.yaml (ambonmud.races or top-level races). */
  races?: string[];
  /** Genders extracted from application.yaml (ambonmud.genders or top-level genders). */
  genders?: string[];
}
