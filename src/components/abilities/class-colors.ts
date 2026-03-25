/** Per-class color mapping for ability UI (tabs, accents, badges). */
const CLASS_COLORS: Record<string, string> = {
  BULWARK: "#bea873",      // Soft gold — heavy plate, shields
  WARDEN: "#c4876a",       // Terracotta — aggressive fur & leather
  ARCANIST: "#a897d2",     // Lavender — arcane magic
  FAEWEAVER: "#8da97b",    // Moss green — nature, living vines
  NECROMANCER: "#88b8a0",  // Ghostly sage — death, clockwork
  VEIL: "#9987b8",         // Deep purple — shadow, stealth
  BINDER: "#c9a050",       // Amber — anti-magic chains, runes
  STORMBLADE: "#8caec9",   // Pale blue — lightning, storm
  HERALD: "#d4c88a",       // Warm ivory gold — divine, sacred
  STARWEAVER: "#b88faa",   // Dusty rose — cosmic energy
};

/** Case-insensitive class color lookup. */
export function getClassColor(className: string): string {
  return CLASS_COLORS[className] || CLASS_COLORS[className.toUpperCase()] || "var(--color-primary-lavender)";
}
