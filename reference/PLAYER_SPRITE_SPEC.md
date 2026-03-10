# Player Sprite System — Paper-Doll Two-Layer Spec

## Overview

Player sprites use a **two-layer generation pipeline** that produces pre-composed full sprites (no runtime compositing). Each sprite depicts one race wearing one class outfit at a specific power tier.

The "two layers" are conceptual — the generation pipeline first establishes a race base body, then generates each class+tier outfit **on that body**. The output is a single image per combination.

## Model

- **Image generator:** Runware FLUX 2 (`runware:400@2`)
- **Output:** 512×512 PNG, solid background (pale lavender `#d8d0e8`)
- **Pose:** Full body, front-facing, neutral standing pose, centered, head-to-toe visible

## Races (12)

| Key | Display | Body Description |
|-----|---------|-----------------|
| `archae` | Archae | Androgynous humanoid, angular features, adaptable build, warm skin tones |
| `mycorae` | Mycorae | Fungal humanoid, bark-like skin, bioluminescent veins, mushroom cap crown, compact frame |
| `aetherae` | Aetherae | NOT humanoid — churning column of black smoke/dark fog, vaguely person-shaped, no skin/face/body, only glowing blue eyes in darkness, ornate cloaks giving structure to formless mist |
| `alorae` | Alorae | NOT humanoid — shimmering prismatic light refraction, like rainbow in a garden hose stream, translucent and ephemeral, no solid body, shifting iridescent color bands dissolving at edges |
| `lustriae` | Lustriae | Petite fae, eternally youthful, large diaphanous stained-glass wings, short and slight |
| `lithae` | Lithae | Living gemstone humanoid, faceted crystal body, polished mineral surfaces, no soft tissue |
| `pyrae` | Pyrae | NOT flesh — figure made of living fire, flickering flame body with molten core, head wreathed in flame, heat shimmer distortion, trailing embers |
| `animae` | Animae | Clockwork undead, mechanical limbs fused with flesh, gear joints, faintly glowing eyes |
| `medusae` | Medusae | Bioluminescent jellyfish humanoid, translucent flowing tendrils, pulsing color glow |
| `kitsarae` | Kitsarae | Fox-spirit humanoid, fuzzy pointed ears, fluffy tails, golden eyes, mischievous |
| `sylflorae` | Sylflorae | Living plant being, petal/vine body, seasonal blooms, leaf hair, no visible skin |
| `orphirae` | Orphirae | Draconic serpentine humanoid, sleek scaled body, aquatic fins, deep-ocean adapted |

### Androgyny Approach

All race base bodies are **gender-neutral by design**. No gender dimension in the sprite ID or generation pipeline.

- **Non-humanoid races** (Aetherae, Lithae, Pyrae, Alorae, Medusae, Mycorae, Sylflorae, Animae, Orphirae): Androgyny is intrinsic — these bodies have no human gender signifiers.
- **Humanoid races** (Archae, Kitsarae, Lustriae): Prompts specify "androgynous figure, narrow shoulders, no visible chest definition, smooth featureless torso, ageless face" and the class overlay covers most of the body.

## Classes (10)

| Key | Display | Visual Identity |
|-----|---------|----------------|
| `bulwark` | Bulwark | Massive heavy armor, tower shield, plate and chain |
| `warden` | Warden | Medium armor with fur/leather accents, hand weapons, aggressive stance |
| `arcanist` | Arcanist | Flowing scholarly robes, arcane tome, glowing sigils |
| `faeweaver` | Faeweaver | Living vine/floral garments, nature staff, entangling roots |
| `necromancer` | Necromancer | Dark robes with clockwork motifs, mechanical undead companion |
| `veil` | Veil | Shadow-wrapped light armor, hooded, dual daggers, half-visible |
| `binder` | Binder | Anti-magic regalia, spell-chain gauntlets, rune-etched armor |
| `stormblade` | Stormblade | Sleek martial armor, dual swords or polearm, fluid/dynamic |
| `herald` | Herald | Sacred vestments, divine glow, healing aura, holy symbol |
| `starweaver` | Starweaver | Cosmic robes with star patterns, shimmering barriers, constellation motifs |

## Tiers (5)

| Key | Levels | Label | Visual Progression |
|-----|--------|-------|--------------------|
| `t0` (tier 0) | 1–9 | Base | Race identity only. Simple wrapped linen clothing, no class identity. A new arrival in Ambon. |
| `t1` (tier 10) | 10–24 | Awakened | Class identity emerges. Basic class-defining outfit and weapon. Functional gear, nothing fancy. |
| `t2` (tier 25) | 25–49 | Ascended | Class mastery. Upgraded materials, subtle magical effects (faint glow, enchanted edges). Class fantasy clearly realized. |
| `t3` (tier 50) | 50 | Legendary | Peak class fantasy. Legendary-tier gear with dramatic magical auras, glowing weapons, elaborate cloaks/accessories. Unmistakably powerful. |
| `staff` | — | Staff | Game administrator. Distinct cosmic/divine aura, unique color treatment (prismatic or celestial), clearly not a player character. |

## Sprite ID Format

```
{race}_{class}_t{tier}
```

Examples:
- `archae_bulwark_t0` — Archae in base clothing (level 1–9)
- `lithae_arcanist_t10` — Lithae Arcanist, Awakened tier
- `pyrae_veil_t50` — Pyrae Veil, Legendary tier
- `medusae_herald_tstaff` — Medusae Herald, Staff tier

For base race (no class): `{race}_base_t0`

### Zone-Prefixed

In the zone YAML, IDs are prefixed: `player_sprites:archae_bulwark_t10`

## Sprite Matrix

| | Base (t0) | Awakened (t10) | Ascended (t25) | Legendary (t50) | Staff (tstaff) |
|---|---|---|---|---|---|
| Per race | 1 | 10 (one per class) | 10 | 10 | 1 |
| **All 12 races** | **12** | **120** | **120** | **120** | **12** |

**Total: 384 sprites**

At ~$0.0006/image (FLUX 2 = Schnell pricing): **~$0.23 for the full set**

## Prompt Template System

A single Claude call generates a template with placeholders:

```
{race_description}, {class_outfit}, {tier_visual}
```

The template is filled per-sprite via string substitution (no additional LLM calls).

### Template Placeholders

| Placeholder | Source |
|-------------|--------|
| `{race}` | Race key (e.g. "archae") |
| `{race_description}` | Full race body description from the race table above |
| `{class}` | Class key (e.g. "bulwark") |
| `{class_outfit}` | Class-specific outfit/weapon description |
| `{tier}` | Tier key (e.g. "t10") |
| `{tier_visual}` | Tier-specific power/equipment description |

### Prompt Structure

```
1:1 square character portrait, full body front-facing neutral standing pose,
centered on 512x512 canvas, head to feet visible with padding,
solid pale lavender (#d8d0e8) background, character sheet lighting,

[Race body description — androgynous, race-specific features],
[Class outfit — armor/robes/weapons specific to this class],
[Tier progression — power level, material quality, magical effects],

[Surreal Gentle Magic style suffix]
```

## Generation Pipeline

### Step 1: Generate Zone Vibe
Standard zone vibe generation from the sprite zone's room descriptions.

### Step 2: Generate Sprite Prompt Template
Single Claude call produces the master template with race descriptions, class outfits, and tier progressions embedded.

### Step 3: Fill & Generate
For each sprite in the matrix:
1. Fill template with race + class + tier values (pure string substitution)
2. Send filled prompt to Runware FLUX 2
3. Store result as a variant

### Step 4: Curate
User reviews sprites in the grid, regenerates any that look off, approves final versions.

## YAML Zone Structure

The sprite zone YAML defines entities using the new ID format:

```yaml
zone: player_sprites
startRoom: entrance

rooms:
  entrance:
    title: "Sprite Gallery"
    description: "..."

mobs:
  # Base race sprites (no class)
  archae_base_t0:
    title: "Archae"
    description: "Androgynous Archae in simple wrapped clothing"
    tier: weak

  # Class sprites per tier
  archae_bulwark_t10:
    title: "Archae Bulwark (Awakened)"
    description: "Archae in basic Bulwark heavy armor"
    tier: weak
  archae_bulwark_t25:
    title: "Archae Bulwark (Ascended)"
    description: "Archae in masterwork Bulwark plate armor with subtle enchantments"
    tier: standard
  # ... etc for all combinations
```

## UI Changes

### Grid Layout
- **No gender tabs** — gender dimension removed entirely
- **Class tabs** remain (one per class, plus "Base" tab for race-only sprites)
- **Rows** = races (12 rows)
- **Columns** = tiers (5 columns: Base, Awakened, Ascended, Legendary, Staff)

### Batch Operations
- "Generate Template" — single Claude call
- "Generate Visible" — all sprites in current class tab
- "Generate All" — all 384 sprites
- "Approve Single-Variant" — auto-approve sprites with exactly one variant

## Migration from Old System

The old system used `{race}_{gender}_{class}_l{tier}` IDs with gender as a dimension. The new system uses `{race}_{class}_t{tier}` — no gender, different tier numbering.

Old sprite zones will no longer match the detection regex and will display as regular mob grids (backward-compatible degradation).
