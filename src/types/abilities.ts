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

export interface AbilityConfig {
  classes: string[];
  targetTypes: string[];
  effectTypes: string[];
}
