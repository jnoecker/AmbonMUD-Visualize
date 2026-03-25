# AmbonMUD-Visualize: AI Asset Generation Tool

**Epic Plan — March 2026**

> **Status:** Core pipeline (rooms, mobs, items, sprites, portraits, abilities) is implemented and working. See the [README](../README.md) for current features.

A standalone desktop application for generating style-consistent images for AmbonMUD zones: room backgrounds, mob sprites, item icons, ability icons, player sprites, and character creation portraits. Uses Claude API to transform zone YAML descriptions into optimized image generation prompts, then calls Runware (FLUX Dev / FLUX 2) to produce assets conforming to the "Surreal Gentle Magic" (surreal_softmagic_v1) design system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Prompt Generation Pipeline](#prompt-generation-pipeline)
4. [Image Generation](#image-generation)
5. [Asset Management Workflow](#asset-management-workflow)
6. [Output & Integration with AmbonMUD](#output--integration-with-ambonmud)
7. [Phased Implementation Plan](#phased-implementation-plan)
8. [MUD Server Changes (AmbonMUD repo)](#mud-server-changes-ambonmud-repo)
9. [Web Client Changes (AmbonMUD repo)](#web-client-changes-ambonmud-repo)
10. [Image Generation Model Research](#image-generation-model-research)
11. [Reference Material](#reference-material)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│              AmbonMUD-Visualize (Desktop App)             │
│                                                           │
│  ┌───────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │ Zone YAML │   │  Claude API  │   │ Runware.AI      │  │
│  │ Parser    │──▶│  (prompt     │──▶│ (FLUX Dev /     │  │
│  │           │   │   builder)   │   │  FLUX 2)        │  │
│  │           │   │              │   │                 │  │
│  └───────────┘   └──────────────┘   └─────────────────┘  │
│       │                │                    │             │
│       ▼                ▼                    ▼             │
│  ┌───────────────────────────────────────────────────┐   │
│  │  Asset Library                                     │   │
│  │  • Zone vibe summary (LLM-generated)              │   │
│  │  • Per-entity: prompt, image(s), approval status  │   │
│  │  • Gallery view with approve/reject/regenerate    │   │
│  │  • Prompt history for reproducibility             │   │
│  └───────────────────────────────────────────────────┘   │
│       │                                                   │
│       ▼                                                   │
│  ┌───────────────────────────────────────────────────┐   │
│  │  Export                                            │   │
│  │  • Updated zone YAML (image: fields added)        │   │
│  │  • Image files organized by zone/type/id          │   │
│  │  • Zone vibe as YAML comment                      │   │
│  │  • Generation prompts as YAML comments            │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
         │
         │ creator copies to MUD repo
         ▼
┌──────────────────────────────────────────────────────────┐
│                    AmbonMUD Server                        │
│                                                           │
│  data/images/{zone}/rooms/{id}.png                       │
│  data/images/{zone}/mobs/{id}.png                        │
│  data/images/{zone}/items/{id}.png                       │
│       │                                                   │
│       ├── Ktor serves /images/* as static files          │
│       ├── WorldLoader reads `image:` from zone YAML      │
│       └── GmcpEmitter includes imageUrl in payloads      │
│                                                           │
│  web-v3 client renders:                                  │
│    • Room illustration panel (16:9 landscape)            │
│    • Mob portraits in World Panel sidebar                │
│    • Item icons in inventory/equipment panels            │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Desktop wrapper | **Tauri 2** | Lightweight native wrapper; ~10x smaller than Electron |
| Frontend | **React 19 + TypeScript + Vite 7** | Reuse web-v3 design tokens and Surreal Gentle Magic CSS |
| Styling | CSS design tokens in `src/styles/tokens.css` | Consistent look with the MUD client; the tool itself should feel on-brand |
| YAML parsing | `yaml` npm package | Parse zone YAML files client-side |
| LLM API | **Anthropic Claude API** (`@anthropic-ai/sdk`) | Prompt generation (description → image prompt) |
| Image Gen API | **Runware.AI** (`@runware/sdk-js`) | FLUX Dev for general assets, FLUX 2 for sprites/portraits |
| Background removal | `@imgly/background-removal` | Client-side BG removal for sprites and items |
| State management | React Context + local JSON project files | No backend needed; project state saved to disk |
| Package manager | **Bun** | Matches web-v3 tooling |

### Separate Repo

- **Repo name:** `AmbonMUD-Visualize`
- Independent from the MUD server codebase
- Parses zone YAML files independently (does not share `WorldLoader.kt`)
- Outputs modified YAML + image files that the creator copies into the MUD repo

---

## Prompt Generation Pipeline

### Step 1: Zone Vibe Summary

When a zone YAML file is loaded, the app sends all room descriptions (plus zone name) to Claude to generate a 2-3 sentence "zone vibe summary" — the overall visual atmosphere.

**Example for `pbrae.yaml`:**
> "A cozy family castle perched on a mountain, blending warm domestic spaces (kitchens, patios, bedrooms) with whimsical children's fantasy worlds. The outdoor areas feature mountain forests, cheerful farmyard poultry, and a royal moat-stream. Interior dream worlds shift between Minecraft pixel-scapes, Rocket League arenas, penguin ice palaces, and stuffed animal groves — each rendered with childlike wonder and magical warmth."

This summary:
- Is stored in the project file
- Is included as a YAML comment at the top of the exported zone file
- Is sent as context for every individual entity prompt

### Step 2: Per-Entity Prompt Generation

For each room/mob/item, the app sends to Claude:

1. **Style guide prompt template** (the standard suffix from STYLE_GUIDE.md):
   ```
   Rendered in the Surreal Gentle Magic style (surreal_softmagic_v1), featuring:
   - Soft lavender and pale blue undertones
   - Ambient diffused lighting (no harsh shadows, no spotlighting)
   - Gentle atmospheric haze with floating motes of light
   - Subtle magical glow integrated naturally into the environment
   - Slightly elongated organic forms (trees, towers, figures)
   - NO neon colors, NO high contrast, NO harsh edges
   - Dreamy, breathable, emotionally safe aesthetic
   ```

2. **Zone vibe summary** (from Step 1)

3. **Entity-specific context:**
   - **Rooms:** title, description, exit directions (for spatial composition hints), any mobs present
   - **Mobs:** name, tier, behavior template, associated room description for environmental context
   - **Items:** displayName, description, slot/type, any room it appears in

4. **Format instruction:**
   - Rooms: "Generate an image prompt for a 16:9 landscape background illustration"
   - Mobs: "Generate an image prompt for a 1:1 square character portrait with transparent background"
   - Items: "Generate an image prompt for a small 1:1 square icon with transparent background"

5. **Claude returns** a refined prompt optimized for image generation

### Step 3: Creator Review

- Creator sees the generated prompt in an editable text field
- Can modify freely before generating
- Prompt is saved with the image for reproducibility

### Prompt Storage

Generated prompts are saved as YAML comments in the exported zone file:

```yaml
rooms:
  # Image prompt: A sun-dappled forest clearing ringed by ancient oaks with
  # soft golden light filtering through the canopy. Gentle moss covers the
  # ground, wildflowers dot the grass. Surreal Gentle Magic style...
  awakening_clearing:
    title: "Awakening Clearing"
    description: "You stand in a sun-dappled clearing..."
    image: "awakening_clearing.png"
```

---

## Image Generation

### Asset Specs (Actual)

| Type | Aspect | Gen Size | Output Size | Format | Model |
|------|--------|----------|-------------|--------|-------|
| Room backgrounds | 16:9 | 1024x576 | 1024x576 | PNG | FLUX Dev |
| Mob sprites | 1:1 | 1024x1024 | 512x512 | PNG | FLUX Dev |
| Item icons | 1:1 | 1024x1024 | 256x256 | PNG | FLUX Dev |
| Ability icons | 1:1 | 1024x1024 | 256x256 | PNG | FLUX Dev |
| Player sprites | 1:1 | 1024x1024 | 512x512 | PNG | FLUX Dev (base) / FLUX 2 (class) |
| Character portraits | 2:3 | 768x1152 | 768x1152 | JPEG | FLUX 2 |

### Image Generation Backend — Runware.AI (Decided)

After a comparison spike (DALL-E 3 vs Stable Diffusion 3.5 — see `spike/`), Runware.AI was selected as the image generation backend using their FLUX models:

| Model | Runware ID | Cost | Use Case |
|-------|-----------|------|----------|
| FLUX Dev | `runware:101@1` | $0.0038/img | General assets (rooms, mobs, items, abilities), base sprites |
| FLUX 2 | `runware:400@2` | $0.0006/img | Player sprites (class tiers), character portraits |
| FLUX Schnell | `runware:100@1` | $0.0006/img | Available as budget option |

The Runware SDK (`@runware/sdk-js`) uses WebSocket connections. The response field for base64 image data is `imageBase64Data`.

### Transparency Handling

Mob/item sprites are generated on a solid pale lavender (`#d8d0e8`) background, then background is removed client-side using `@imgly/background-removal`. This produces cleaner results than prompting for transparent backgrounds.

### Cost (Actual)

At FLUX Dev pricing ($0.0038/img):
- PBrae zone (~80 entities): ~$0.30 per generation pass
- Full 384-sprite set (FLUX 2): ~$0.23
- 22 character portraits (FLUX 2): ~$0.01
- Claude API for prompt generation: negligible

---

## Asset Management Workflow

### Project Structure

The app works with "projects" — a local directory containing:

```
my-project/
├── project.json           # project metadata, API keys, settings
├── zones/
│   ├── pbrae/
│   │   ├── source.yaml    # original imported zone YAML
│   │   ├── vibe.txt       # LLM-generated zone vibe summary
│   │   ├── assets.json    # asset tracking (prompts, status, metadata)
│   │   ├── rooms/
│   │   │   ├── awakening_clearing/
│   │   │   │   ├── prompt.txt
│   │   │   │   ├── v1.png          # variant 1
│   │   │   │   ├── v2.png          # variant 2
│   │   │   │   └── approved.png    # selected/approved version
│   │   │   └── mossy_trail/
│   │   │       └── ...
│   │   ├── mobs/
│   │   │   └── ...
│   │   └── items/
│   │       └── ...
│   └── tutorial_glade/
│       └── ...
└── export/                 # export output directory
    ├── yaml/               # modified zone YAML files
    └── images/             # organized image files
```

### UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  AmbonMUD Visualize                                    [─][□][×]│
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  Zone: PBrae │  Entity: Penguin Palace                         │
│              │                                                  │
│  ▼ Rooms     │  ┌────────────────────────────────────────────┐ │
│    mountain  │  │                                            │ │
│    waterfall │  │         [Image Preview Area]               │ │
│    forest    │  │                                            │ │
│  > castle    │  │    (shows approved image or variants)      │ │
│    ◉ kitchen │  │                                            │ │
│    ◉ living  │  └────────────────────────────────────────────┘ │
│    ○ patio   │                                                  │
│  > coop      │  Prompt:                                        │
│  > peanut    │  ┌────────────────────────────────────────────┐ │
│  > braelynn  │  │ A grand hall of pale blue ice and carved   │ │
│    ◉ palace  │  │ snowdrifts where penguins in tiny formal   │ │
│    ○ rink    │  │ wear shuffle about...                      │ │
│              │  └────────────────────────────────────────────┘ │
│  ▶ Mobs      │                                                  │
│  ▶ Items     │  [Generate Prompt] [Generate Image] [Approve]   │
│              │                                                  │
│              │  Variants: [v1] [v2] [v3] [v4]                  │
│              │                                                  │
│──────────────│  Status: ◉ approved  ○ pending  ✕ rejected      │
│ Zone Vibe:   │                                                  │
│ "A cozy      │  ┌─ Settings ──────────────────────────────┐   │
│  family      │  │ Variants per generation: [4]            │   │
│  castle..."  │  │ Image model: [Flux 1.1 Pro ▾]          │   │
│              │  │ Resolution: [1920x1080 ▾]               │   │
│              │  └─────────────────────────────────────────┘   │
├──────────────┴──────────────────────────────────────────────────┤
│  Progress: 23/55 rooms approved  │  [Export Zone]  [Batch Gen] │
└─────────────────────────────────────────────────────────────────┘

Legend:  ◉ = has approved image    ○ = no image yet    ✕ = rejected
```

### Key Interactions

1. **Open Zone** — File picker → load YAML → parse rooms/mobs/items → display in sidebar
2. **Generate Zone Vibe** — One click → sends all descriptions to Claude → displays summary
3. **Generate Prompt** — Select entity → click → Claude generates optimized prompt → editable
4. **Generate Image** — Click → sends prompt to image API → displays variant(s)
5. **Approve/Reject** — Click variant to approve → marked as final asset
6. **Regenerate** — Edit prompt → regenerate → new variants appear
7. **Batch Generate** — "Generate all missing" → processes queue with progress bar
8. **Export** — Writes updated zone YAML + copies approved images to export directory

### Swarm/Training Zone Handling

For procedurally similar zones (training zones with many similar rooms), the UI should:
- Detect rooms with highly similar descriptions
- Suggest reusing a single image across similar rooms
- Allow the creator to "link" rooms to share one image
- Only generate unique images for distinct room types

---

## Output & Integration with AmbonMUD

### Exported Zone YAML

The export process:
1. Copies the original zone YAML
2. Adds `image:` field to each room/mob/item that has an approved image
3. Adds the zone vibe summary as a comment at the top
4. Adds each entity's generation prompt as a comment above the entity
5. Creator copies the YAML file back to `src/main/resources/world/` in the MUD repo

```yaml
# Zone Vibe: A cozy family castle perched on a mountain, blending warm
# domestic spaces with whimsical children's fantasy worlds. The outdoor
# areas feature mountain forests, cheerful farmyard poultry, and a royal
# moat-stream...

zone: pbrae
lifespan: 0
startRoom: gravel_road

rooms:
  # Image prompt: Mountain summit with a gleaming castle below among
  # trees, silver stream glittering, wind-swept clouds, soft golden
  # light, Surreal Gentle Magic style...
  mountain_summit:
    title: "The Summit of Castle Mountain"
    description: "You stand atop the peak that Castle PBrae calls home..."
    image: "mountain_summit.png"
    exits:
      e: waterfall_cliff
      d: mountain_path
```

### Exported Image Directory Structure

```
export/images/
└── pbrae/
    ├── rooms/
    │   ├── mountain_summit.png      (1920x1080)
    │   ├── waterfall_cliff.png
    │   ├── mountain_path.png
    │   └── ...
    ├── mobs/
    │   ├── forest_deer.png          (512x512, transparent)
    │   ├── royal_rooster.png
    │   └── ...
    └── items/
        ├── royal_egg.png            (256x256, transparent)
        ├── rooster_feather.png
        └── ...
```

Creator copies this to `data/images/` in the MUD repo (this directory is outside the JAR build).

---

## Phased Implementation Plan

### Phase 1: Room Backgrounds MVP — COMPLETE

Full end-to-end pipeline for room backgrounds.

- [x] Tauri 2 + React 19 + TypeScript + Vite project with Bun
- [x] Surreal Gentle Magic design tokens ported to `src/styles/tokens.css`
- [x] App shell: sidebar + main panel + settings
- [x] Zone YAML parser (rooms, mobs, items)
- [x] Project file management (create, open, save)
- [x] Claude API integration + zone vibe generation
- [x] Per-room prompt construction + editable prompt field
- [x] Runware FLUX Dev image generation
- [x] Variant management + approve/reject workflow
- [x] Export (YAML modification + image files)

### Phase 2: Mob Sprites — COMPLETE

- [x] 1:1 aspect ratio generation (1024x1024 → 512x512 output)
- [x] Background removal via `@imgly/background-removal`
- [x] Mob-specific prompt construction
- [x] Mob gallery in sidebar
- [x] Export with mob images

### Phase 3: Item Icons — COMPLETE

- [x] Item icon generation (1024x1024 → 256x256 output)
- [x] Item-specific prompt construction
- [x] Item gallery in sidebar
- [x] Export with item images

### Phase 4: Batch Operations & Polish — COMPLETE

- [x] Batch generation with concurrent processing + progress tracking
- [x] Batch approve (auto-approve single-variant entities)
- [x] Batch recompress and batch BG removal dialogs
- [x] Default images (fallback room/mob/item per zone)
- [x] Image reconciliation (recover untracked variants from disk)
- [x] Entity field editing
- [x] Custom asset generation dialog

### Phase 5: Extended Asset Types — COMPLETE

- [x] Player sprites — 384-sprite paper-doll system (see `PLAYER_SPRITE_SPEC.md`)
- [x] Character creation portraits — 22 cinematic race/class portraits (see `CHARACTER_PORTRAIT_SPEC.md`)
- [x] Ability icons — 100 abilities across 10 classes with class-specific colors

### Phase 6: Multimedia (In Progress)

- [x] Zone music generation
- [x] Zone video generation (zone intros, boss reveals, item reveals)

### Future

- [ ] Style variant support (surreal_softmagic_v2, _night, _feycourt, etc.)
- [ ] Cost tracking dashboard
- [ ] Template prompts for common room types

---

## MUD Server Changes (AmbonMUD repo)

> **Note:** This section describes planned changes to the **AmbonMUD server repo**, not this app. Included here for context on how exported assets integrate with the MUD.

These changes happen in the main AmbonMUD repo after the Visualize tool produces its first outputs.

### WorldLoader: Parse `image` field

Add `image` field to `RoomFile`, `MobFile`, `ItemFile` data classes in `WorldFile.kt`:

```kotlin
// In RoomFile
val image: String? = null

// In MobFile
val image: String? = null

// In ItemFile
val image: String? = null
```

Propagate through `Room`, `MobTemplate`, `ItemDefinition` domain models.

### Static Image Serving

Add a Ktor route in `KtorWebSocketTransport` (or a new module) to serve images:

```kotlin
routing {
    static("/images") {
        files(config.imageDirectory)  // e.g., "data/images"
    }
}
```

Config addition to `AppConfig.kt`:
```kotlin
val imageDirectory: String = "data/images"
```

### GMCP: Add imageUrl to Existing Packages

**Room.Info** (extend existing payload):
```json
{
  "name": "Awakening Clearing",
  "zone": "tutorial_glade",
  "description": "You stand in a sun-dappled clearing...",
  "exits": {"n": "mossy_trail"},
  "imageUrl": "/images/tutorial_glade/rooms/awakening_clearing.png"
}
```

**Room.Mobs** (extend existing mob entries):
```json
{
  "mobs": [
    {
      "name": "a grey wolf",
      "id": "tutorial_glade:grey_wolf",
      "imageUrl": "/images/tutorial_glade/mobs/grey_wolf.png"
    }
  ]
}
```

**Char.Items** / inventory payloads (extend):
```json
{
  "items": [
    {
      "keyword": "pendant",
      "displayName": "a wolf fang pendant",
      "imageUrl": "/images/tutorial_glade/items/wolf_fang_pendant.png"
    }
  ]
}
```

The `imageUrl` field is only included when the entity has an image defined. Clients that don't handle it simply ignore the extra field (backwards compatible).

### Image Directory Convention

```
data/images/
├── pbrae/
│   ├── rooms/
│   │   ├── mountain_summit.png
│   │   └── ...
│   ├── mobs/
│   │   └── ...
│   └── items/
│       └── ...
├── tutorial_glade/
│   └── ...
└── demo_ruins/
    └── ...
```

This directory is `.gitignore`-d like `data/players/`. Images are deployed separately (copied to the server or later migrated to S3/CDN).

---

## Web Client Changes (AmbonMUD repo)

> **Note:** This section describes planned changes to the **AmbonMUD web client**, not this app.

### Room Illustration Panel

Add a new panel or section to `PlayPanel.tsx` — a room illustration area that displays the current room's background image.

- **Position:** Above the terminal text output, collapsible
- **Size:** Full width of the Play panel, 16:9 aspect ratio (or configurable height)
- **Behavior:**
  - When `Room.Info` includes `imageUrl`, fade in the image (300ms `ease-out-soft`)
  - When moving to a room without an image, fade to a subtle gradient placeholder
  - Vignette overlay on edges to blend into the dark UI
  - Respect the Surreal Gentle Magic dark theme
- **Performance:** Lazy load, cache recently visited room images

### Mob Portraits (Phase 2)

In `WorldPanel.tsx`, show small circular portraits next to mob names in the mob list when `imageUrl` is present.

### Item Icons (Phase 3)

In `CharacterPanel.tsx`, show small icons next to items in inventory and equipment panels.

### GMCP Handler Updates

In `applyGmcpPackage.ts`, extract `imageUrl` from existing packages and store in the appropriate state.

---

## Image Generation Model Research — COMPLETE

A comparison spike tested DALL-E 3 and Stable Diffusion 3.5 against 18 entities across two zones (pbrae, wesleyalis), covering rooms, mobs, and items. See `spike/` for the original comparison code and output images.

**Decision:** Runware.AI with FLUX models was selected for:
- Strong style consistency with the Surreal Gentle Magic aesthetic
- Low cost (FLUX Dev at $0.0038/img, FLUX 2 at $0.0006/img)
- WebSocket-based SDK with good developer experience
- Support for multiple aspect ratios and img2img workflows

**Transparency approach:** Generate on solid pale lavender (`#d8d0e8`) background, then remove background client-side with `@imgly/background-removal`. This produces cleaner results than native transparency prompting.

---

## Reference Material

Documents from the AmbonMUD repo, now in `reference/`:

| Document | Purpose | Status |
|----------|---------|--------|
| `reference/STYLE_GUIDE.md` | Surreal Gentle Magic design system, color palette, prompt template | Copied, used for prompt engineering + UI design |
| `reference/WORLD_YAML_SPEC.md` | Zone YAML schema for parser implementation | Copied, used for YAML parsing |
| `reference/styles.css` | Original CSS design tokens from web-v3 | Ported to `src/styles/tokens.css` |
| `reference/PLAYER_SPRITE_SPEC.md` | Paper-doll sprite system specification | Written for this app |
| `reference/CHARACTER_PORTRAIT_SPEC.md` | Character creation portrait specification | Written for this app |
| `reference/pbrae.yaml`, `wesleyalis.yaml`, `trailey.yaml` | Test zone files | Copied from MUD server |
| `reference/player_sprites.yaml`, `character_portraits.yaml` | Test zone files for sprite/portrait generation | Written for this app |
| `reference/abilities.yaml` | Ability definitions (100 abilities, 41 status effects) | Written for this app |

### Key Style Guide Excerpts for Prompt Engineering

**Always append to every image generation prompt:**
```
Rendered in the Surreal Gentle Magic style (surreal_softmagic_v1), featuring:
- Soft lavender and pale blue undertones
- Ambient diffused lighting (no harsh shadows, no spotlighting)
- Gentle atmospheric haze with floating motes of light
- Subtle magical glow integrated naturally into the environment
- Slightly elongated organic forms (trees, towers, figures)
- NO neon colors, NO high contrast, NO harsh edges
- Dreamy, breathable, emotionally safe aesthetic
```

**Color palette for reference prompts:**
- Lavender: `#a897d2`
- Pale Blue: `#8caec9`
- Dusty Rose: `#b88faa`
- Moss Green: `#8da97b`
- Soft Gold: `#bea873`
- Deep Mist (background): `#22293c`

**Forbidden in generated images:**
- Neon colors
- Pure black backgrounds
- Sharp rim lights or hard shadows
- High-contrast chiaroscuro
- Harsh geometric symmetry
- Mechanical/industrial aesthetic
