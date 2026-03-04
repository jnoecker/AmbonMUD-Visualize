export interface SpriteDimensions {
  race: string;
  playerClass: string;
  tier: number;
}

export interface SpriteConfig {
  races: string[];
  classes: string[];
  tiers: number[];
}

/** A sprite group is one race+class across all tiers. */
export interface SpriteGroup {
  race: string;
  playerClass: string;
  /** Maps tier number to the full entity ID (e.g. "player_sprites:human_warrior_l1"). */
  entityIds: Record<number, string>;
}

export interface SpritePromptTemplate {
  template: string;
  tierDescriptions: Record<number, string>;
  generatedAt: string;
}
