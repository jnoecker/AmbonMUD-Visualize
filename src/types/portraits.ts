/** Configuration for a portrait zone (auto-detected). */
export interface PortraitConfig {
  races: string[];   // e.g. ["archae", "mycorae", ...]
  classes: string[];  // e.g. ["bulwark", "warden", ...]
}

/** Template returned by Claude for portrait prompt generation. */
export interface PortraitPromptTemplate {
  raceTemplate: string;  // prompt template with {race_description} placeholder
  classTemplate: string; // prompt template with {race_description}, {class_outfit} placeholders
  raceDescriptions: Record<string, string>;  // race key → prompt fragment
  classOutfits: Record<string, string>;      // class key → prompt fragment
  generatedAt: string;
}

/** Parsed portrait entity ID. */
export interface PortraitDimensions {
  portraitType: "race" | "class";
  key: string;  // race key or class key
}
