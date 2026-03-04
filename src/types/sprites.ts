export interface SpriteDimensions {
  race: string;
  gender: string;
  playerClass: string;
  tier: number;
}

export interface SpriteConfig {
  races: string[];
  genders: string[];
  classes: string[];
  tiers: number[];
}

/** A sprite group is one race+gender+class across all tiers. */
export interface SpriteGroup {
  race: string;
  gender: string;
  playerClass: string;
  /** Maps tier number to the full entity ID (e.g. "player_sprites:human_male_warrior_l1"). */
  entityIds: Record<number, string>;
}

export interface SpritePromptTemplate {
  template: string;
  tierDescriptions: Record<number, string>;
  generatedAt: string;
}
