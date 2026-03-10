export interface SpriteDimensions {
  race: string;
  playerClass: string;
  tier: string; // "t0", "t10", "t25", "t50", "tstaff"
}

export interface SpriteConfig {
  races: string[];
  classes: string[];
  tiers: string[];
}

/** A sprite group is one race+class across all tiers. */
export interface SpriteGroup {
  race: string;
  playerClass: string;
  /** Maps tier key to the full entity ID (e.g. "player_sprites:archae_bulwark_t10"). */
  entityIds: Record<string, string>;
}

export interface SpritePromptTemplate {
  template: string;
  tierDescriptions: Record<string, string>;
  raceDescriptions: Record<string, string>;
  classOutfits: Record<string, string>;
  generatedAt: string;
}

/** Canonical race definitions for Ambon. */
export const RACE_DEFINITIONS: Record<string, { displayName: string; bodyDescription: string }> = {
  archae: {
    displayName: "Archae",
    bodyDescription: "Androgynous humanoid, angular features, adaptable athletic build, warm skin tones, ageless face, no gendered features",
  },
  mycorae: {
    displayName: "Mycorae",
    bodyDescription: "Fungal humanoid, bark-like textured skin, bioluminescent veins glowing with cyan-green light, layered mushroom cap crown atop head, compact sturdy frame",
  },
  aetherae: {
    displayName: "Aetherae",
    bodyDescription: "a haunted empty cloak floating in midair, the cloak draped over churning black smoke and dark fog instead of a body, two glowing blue eyes floating in the darkness of the hood, the bottom of the cloak fraying into wisps of black vapor, dark vapor leaking from the cuffs of the sleeves, a ghost made of shadow wearing stolen clothes, armor and gear draped over the smoke-filled cloak form",
  },
  alorae: {
    displayName: "Alorae",
    bodyDescription: "a glowing humanoid figure made entirely of prismatic refracting light — the body itself shimmers with vivid rainbow color bands (pink, cyan, gold, violet) like light through a crystal prism. Skin is replaced by shifting iridescent luminescence, see-through in places revealing a bright white core glow inside. The face is a smooth featureless oval of bright pearlescent light with no eyes nose or mouth. Hands and feet glow white-hot and fade into sparkling motes at the fingertips and toes. Hair is streaming rays of refracted light. The entire figure radiates a strong bright prismatic aura halo",
  },
  lustriae: {
    displayName: "Lustriae",
    bodyDescription: "Petite fae figure, eternally youthful androgynous face, large vivid brightly-colored butterfly wings with bold jewel-tone stained-glass patterns and a soft glowing luminous aura outline around each wing edge, short and slight build, wings fully opaque with saturated color not translucent",
  },
  lithae: {
    displayName: "Lithae",
    bodyDescription: "Living gemstone humanoid, faceted crystal body of amethyst and quartz, polished mineral surfaces, no soft tissue, light refracting through joints",
  },
  pyrae: {
    displayName: "Pyrae",
    bodyDescription: "Humanoid figure made of living fire, body is flickering flame not flesh, no skin visible — torso and limbs are shaped fire with a molten core glowing through, head wreathed in flame instead of hair, heat shimmer distorting the air around them, embers trailing from extremities",
  },
  animae: {
    displayName: "Animae",
    bodyDescription: "Undead wight with clockwork augmentation — pale gray decaying flesh stitched together with brass rivets and copper wire, patches of exposed bone reinforced with small gears and metal plates, sunken glowing eyes in a gaunt cadaverous face, some fingers skeletal with tiny clockwork joints added, a reanimated corpse held together by mechanical repairs",
  },
  medusae: {
    displayName: "Medusae",
    bodyDescription: "Bioluminescent jellyfish humanoid, translucent flowing tendrils for hair, pulsing color glow beneath translucent skin, graceful aquatic form",
  },
  kitsarae: {
    displayName: "Kitsarae",
    bodyDescription: "Fox-spirit humanoid, large fuzzy pointed ears, multiple fluffy tails, golden amber eyes, sharp androgynous features, mischievous expression",
  },
  sylflorae: {
    displayName: "Sylflorae",
    bodyDescription: "Living plant being, body formed of woven petals and vines, leaf hair with seasonal blooms, no visible skin, flowers budding at joints",
  },
  orphirae: {
    displayName: "Orphirae",
    bodyDescription: "Draconic serpentine humanoid, sleek iridescent scaled body, aquatic fins along arms and spine, deep-ocean adapted, powerful and sinuous",
  },
};

/** Canonical class definitions for Ambon. */
export const CLASS_DEFINITIONS: Record<string, { displayName: string; outfitDescription: string }> = {
  bulwark: {
    displayName: "Bulwark",
    outfitDescription: "massive heavy plate armor, tower shield, layered chain and plate, defensive fortress silhouette",
  },
  warden: {
    displayName: "Warden",
    outfitDescription: "medium armor with fur and leather accents, hand axe or mace, battle-worn and aggressive",
  },
  arcanist: {
    displayName: "Arcanist",
    outfitDescription: "flowing scholarly robes with arcane embroidery, ornate arcane staff in hand, glowing tome floating nearby, sigils orbiting",
  },
  faeweaver: {
    displayName: "Faeweaver",
    outfitDescription: "living vine and floral garments woven from nature, twisted wooden staff with budding flowers, roots trailing at feet",
  },
  necromancer: {
    displayName: "Necromancer",
    outfitDescription: "dark layered robes with clockwork bone motifs, skull-topped staff with spinning gears, green-tinged glow on hands",
  },
  veil: {
    displayName: "Veil",
    outfitDescription: "shadow-wrapped light armor, deep hood obscuring face, dual curved daggers, half-visible in shadow",
  },
  binder: {
    displayName: "Binder",
    outfitDescription: "anti-magic regalia with rune-etched plates, spell-chain gauntlets with floating broken rune links, suppression aura",
  },
  stormblade: {
    displayName: "Stormblade",
    outfitDescription: "sleek martial armor designed for speed, single long zig-zag lightning-bolt shaped sword, fluid dynamic pose",
  },
  herald: {
    displayName: "Herald",
    outfitDescription: "sacred vestments with divine golden trim, large ornate holy mace in hand, holy symbol pendant",
  },
  starweaver: {
    displayName: "Starweaver",
    outfitDescription: "cosmic robes with shifting star patterns and constellation embroidery, hands glowing with celestial aura, no weapon",
  },
};

/** Tier definitions for sprite progression. */
export const TIER_DEFINITIONS: Record<string, { displayName: string; levels: string; visualDescription: string }> = {
  t0: {
    displayName: "Base",
    levels: "1–9",
    visualDescription: "Simple wrapped linen clothing, no armor, no weapons, no magical effects. A new arrival in Ambon. Race identity only.",
  },
  t10: {
    displayName: "Awakened",
    levels: "10–24",
    visualDescription: "Basic class-defining outfit and simple weapon. Functional gear, nothing ornate. First signs of class identity.",
  },
  t25: {
    displayName: "Ascended",
    levels: "25–49",
    visualDescription: "Upgraded quality materials, subtle magical effects — faint enchanted glow on weapon edges, improved armor. Class fantasy clearly realized.",
  },
  t50: {
    displayName: "Legendary",
    levels: "50",
    visualDescription: "Peak class fantasy. Legendary-tier gear with dramatic magical auras, glowing weapons, elaborate cloaks and accessories. Unmistakably powerful.",
  },
  tstaff: {
    displayName: "Staff",
    levels: "—",
    visualDescription: "Game administrator. Distinct cosmic prismatic aura, celestial crown or halo, unique iridescent color treatment. Clearly not a player character — a being of authority.",
  },
};

/**
 * Per-race full prompt overrides for staff (tstaff) tier.
 * These bypass the template entirely — each is a complete, unique god-tier prompt.
 */
export const STAFF_RACE_PROMPTS: Record<string, string> = {
  archae:
    "An ascended Archae administrator — a towering androgynous humanoid figure wreathed in slowly rotating rings of golden light, skin now polished marble-white with veins of molten gold visible beneath the surface, eyes replaced by twin blazing suns, wearing flowing robes woven from pure starlight that trail into infinity, a massive celestial halo of interlocking geometric sigils orbiting behind the head, bare feet hovering above a pool of liquid light, the air around them shimmering with divine authority",

  mycorae:
    "A transcendent Mycorae administrator — a colossal fungal deity, the mushroom cap crown has expanded into an enormous luminous parasol canopy radiating waves of golden spore-light, the bark-skin body is now ancient petrified heartwood laced with circuits of blazing bioluminescent amber, dozens of smaller glowing mushrooms orbit the figure like a living constellation, roots of pure light extend downward dissolving into motes, every surface pulses with the slow rhythm of an ancient forest heartbeat made visible",

  aetherae:
    "A supreme Aetherae administrator — an immense billowing cloak of midnight-black void fabric, far larger than any mortal garment, the hood contains not just two eyes but an entire swirling galaxy of stars and nebulae visible within the darkness, the cloak edges burn with bright golden fire, the smoke pouring from within is now luminous stardust, a massive crown of floating golden shards orbits above the hood, the entire figure radiates an aura of cosmic dread and divine majesty",

  alorae:
    "An ultimate Alorae administrator — a blindingly radiant figure of pure white-gold light, the prismatic body has intensified into a miniature star, corona flares of rainbow light erupting from the shoulders and head, the featureless face now shines like a second sun with a halo of concentric prismatic rings behind it, the entire form pulses with visible waves of creative energy radiating outward, motes of newborn light continuously spark into existence around them like a fountain of stars",

  lustriae:
    "A divine Lustriae administrator — an ethereal fae figure whose butterfly wings have grown immense and magnificent, each wing a cathedral window of blazing jewel-tone stained glass depicting cosmic scenes, the wings radiate their own golden sunlight from within, a crown of living butterflies made of pure light orbits the head, the small body glows with internal golden radiance, every wingbeat sends cascading waves of luminous prismatic dust, an unmistakable being of supreme fae authority",

  lithae:
    "A perfected Lithae administrator — a towering living gemstone colossus, the crystal body has achieved flawless clarity and now refracts an inner sun into blinding rainbow caustics in every direction, the facets have become impossibly complex and precise like a divine cut, veins of liquid gold flow between crystal segments, a crown of orbiting raw gemstones — diamond, ruby, sapphire, emerald — each blazing with inner fire, the entire figure hums with a deep resonant harmonic visible as golden sound-waves in the air",

  pyrae:
    "A supreme Pyrae administrator — a towering inferno deity, the flame-body has intensified from orange fire to searing blue-white plasma at the core with gold and violet outer flames, a crown of seven distinct flame pillars rises from the head like a solar corona, the heat shimmer around them warps reality itself into rippling distortions, molten gold drips upward from the hands defying gravity, the eyes are twin white-hot stars, an overwhelming presence of divine volcanic power",

  animae:
    "A perfected Animae administrator — an ancient undead lord whose clockwork augmentation has achieved divine precision, the decaying flesh is now reinforced with gleaming celestial brass and orichalcum, a massive orrery of golden gears and celestial spheres orbits behind the head like a mechanical halo, the sunken eyes blaze with intense golden light, intricate golden clockwork has replaced entire limbs with masterwork mechanical perfection, every gear and rivet inscribed with microscopic divine runes",

  medusae:
    "A transcendent Medusae administrator — a massive bioluminescent jellyfish deity, the translucent body now pulses with deep golden light from an internal sun, tendrils have multiplied into hundreds of flowing luminous filaments each tipped with a tiny star, the bell-dome head has expanded into a magnificent glowing cathedral shape with visible galaxies swirling within, waves of golden bioluminescence pulse outward in slow majestic rhythms, an oceanic god of living light",

  kitsarae:
    "A supreme Kitsarae administrator — a divine fox-spirit with nine enormous tails each blazing with a different color of sacred foxfire — gold, silver, white, crimson, azure, violet, emerald, amber, and prismatic, the amber eyes now blaze like twin golden suns, elaborate celestial markings glow across the face and body in shifting patterns, a crown of floating golden spirit-flames orbits the head, every tail-tip trails a stream of divine sparks, an unmistakable nine-tailed celestial sovereign",

  sylflorae:
    "A divine Sylflorae administrator — a towering living tree-god in humanoid form, the petal-and-vine body has matured into ancient sacred heartwood with golden sap visibly flowing through translucent bark, the leaf-hair has become a magnificent canopy of every season simultaneously — spring blossoms, summer green, autumn gold, winter crystal — all blazing with inner light, massive golden flowers bloom and spiral in a perpetual cycle across the entire form, roots of pure golden light anchor into the ground",

  orphirae:
    "A supreme Orphirae administrator — a colossal draconic sea-deity, the iridescent scales now blaze with deep-ocean bioluminescence and veins of liquid gold, enormous aquatic fins along the arms and spine have expanded into magnificent sail-like crests glowing with inner light, a crown of living coral and golden pearls orbits the horned head, the eyes are twin pools of abyssal golden light, the entire sinuous form radiates crushing deep-ocean pressure made visible as golden rippling waves of force",
};

/** Ordered tier keys for display. */
export const TIER_ORDER: string[] = ["t0", "t10", "t25", "t50", "tstaff"];

/** Ordered race keys for display. */
export const RACE_ORDER: string[] = [
  "archae", "mycorae", "aetherae", "alorae", "lustriae", "lithae",
  "pyrae", "animae", "medusae", "kitsarae", "sylflorae", "orphirae",
];

/** Ordered class keys for display (plus "base" pseudo-class for t0). */
export const CLASS_ORDER: string[] = [
  "base", "bulwark", "warden", "arcanist", "faeweaver", "necromancer",
  "veil", "binder", "stormblade", "herald", "starweaver",
];
