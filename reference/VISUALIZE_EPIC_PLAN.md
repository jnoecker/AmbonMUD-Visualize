# AmbonMUD-Visualize: AI Asset Generation Tool

**Epic Plan — March 2026**

A standalone desktop application for generating style-consistent images for AmbonMUD zones: room backgrounds, mob sprites, and item icons. Uses an LLM (Claude API) to transform zone YAML descriptions into optimized image generation prompts, then calls an image generation API to produce assets that conform to the "Surreal Gentle Magic" (surreal_softmagic_v1) design system.

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
│  │ Zone YAML │   │  Claude API  │   │ Image Gen API   │  │
│  │ Parser    │──▶│  (prompt     │──▶│ (pluggable:     │  │
│  │           │   │   builder)   │   │  Flux/DALL-E/   │  │
│  │           │   │              │   │  SD3/Ideogram)  │  │
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
| Desktop wrapper | **Tauri** (preferred) or Electron | Lightweight native wrapper; Tauri is ~10x smaller than Electron |
| Frontend | **React + TypeScript + Vite** | Reuse web-v3 design tokens and Surreal Gentle Magic CSS |
| Styling | web-v3 `styles.css` design tokens | Consistent look with the MUD client; the tool itself should feel on-brand |
| YAML parsing | `js-yaml` or `yaml` npm package | Parse zone YAML files client-side |
| LLM API | **Anthropic Claude API** (`@anthropic-ai/sdk`) | Prompt generation (description → image prompt) |
| Image Gen API | **Pluggable** — start with one, add others | See [Image Generation Model Research](#image-generation-model-research) |
| State management | React state + local JSON project files | No backend needed; project state saved to disk |
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

### Model Requirements

| Requirement | Room Backgrounds | Mob Sprites | Item Icons |
|-------------|-----------------|-------------|------------|
| Aspect ratio | 16:9 landscape | 1:1 square | 1:1 square |
| Transparency | No | Yes (PNG alpha) | Yes (PNG alpha) |
| Resolution | 1920x1080 or 1280x720 | 512x512 or 1024x1024 | 256x256 or 512x512 |
| Format | PNG | PNG | PNG |

### Pluggable Backend Interface

```typescript
interface ImageGenerator {
  name: string
  generate(prompt: string, options: GenerateOptions): Promise<GeneratedImage[]>
  supportsTransparency: boolean
}

interface GenerateOptions {
  aspectRatio: "16:9" | "1:1"
  width: number
  height: number
  count: number          // how many variants to generate (configurable)
  transparent: boolean   // request transparent background
  negativePrompt?: string
}

interface GeneratedImage {
  data: Buffer           // raw PNG bytes
  revisedPrompt?: string // some APIs revise the prompt
  seed?: string          // for reproducibility
  metadata: Record<string, unknown>
}
```

### Candidate Models (Research Spike Needed)

| Model | API | Transparency | Cost/image | Notes |
|-------|-----|-------------|-----------|-------|
| Flux 1.1 Pro | Replicate / BFL | Post-process | ~$0.04 | Strong style consistency |
| DALL-E 3 | OpenAI API | Post-process | $0.04-0.08 | Good prompt adherence |
| Stable Diffusion 3.5 | Stability API | Post-process | $0.03-0.06 | Self-host option |
| Ideogram 2.0 | Ideogram API | Native | $0.02-0.08 | Native transparency |
| Google Imagen 3 | Vertex AI | Post-process | ~$0.04 | Good quality |

**Transparency handling:** Most models don't natively support transparent backgrounds. For mob/item sprites, the pipeline should:
1. Generate on a solid color background (e.g., pure green/magenta)
2. Auto-remove background using a background removal step (rembg, or an API like remove.bg)

### Cost Estimation

For the PBrae zone alone:
- ~55 rooms × $0.05 = ~$2.75
- ~18 mobs × $0.05 = ~$0.90
- ~8 items × $0.05 = ~$0.40
- **Total per zone: ~$4** (single generation, no variants)
- With 4 variants each: ~$16/zone
- Claude API for prompt generation: negligible (~$0.10/zone)

For all ~200 rooms + 100 mobs/items across the game: **~$20-80** depending on variant count.

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

### Phase 1: Room Backgrounds MVP

**Goal:** Full end-to-end pipeline for room backgrounds only.

**1.1 — Project Scaffolding**
- [ ] Initialize Tauri + React + TypeScript + Vite project with Bun
- [ ] Port Surreal Gentle Magic design tokens from web-v3 `styles.css`
- [ ] Basic app shell: sidebar + main panel + settings
- [ ] Zone YAML parser (rooms, mobs, items)
- [ ] Project file management (create, open, save)

**1.2 — Zone Vibe Generation**
- [ ] Claude API integration (`@anthropic-ai/sdk`)
- [ ] Zone vibe prompt construction
- [ ] Zone vibe display + editing in UI
- [ ] API key configuration in settings

**1.3 — Room Prompt Generation**
- [ ] Style guide template integration
- [ ] Per-room prompt construction (title + description + exits + mobs → Claude → prompt)
- [ ] Editable prompt field
- [ ] Prompt storage in project

**1.4 — Image Generation (First Model)**
- [ ] Image generation model research spike (see below)
- [ ] First backend implementation (likely Flux or DALL-E 3)
- [ ] Configurable variant count (1-4)
- [ ] Image display and variant selection

**1.5 — Approve/Reject Workflow**
- [ ] Per-room approval status tracking
- [ ] Variant comparison view
- [ ] Progress tracking (X/Y rooms approved)

**1.6 — Export**
- [ ] Zone YAML modification (add `image:` fields)
- [ ] Zone vibe + prompts as YAML comments
- [ ] Image file export to organized directory
- [ ] Swarm/duplicate detection for training zones

### Phase 2: Mob Sprites

- [ ] 1:1 aspect ratio generation
- [ ] Transparent background pipeline (background removal post-processing)
- [ ] Mob-specific prompt construction (name, tier, behavior, room context)
- [ ] Mob gallery in sidebar
- [ ] Export with mob images

### Phase 3: Item Icons

- [ ] Small icon generation (256x256)
- [ ] Item-specific prompt construction (displayName, description, slot type)
- [ ] Item gallery in sidebar
- [ ] Export with item images

### Phase 4: Batch Operations & Polish

- [ ] "Generate all missing" batch mode with progress bar and rate limiting
- [ ] Prompt history and regeneration tracking
- [ ] Multiple image generation backends (add 2nd and 3rd model)
- [ ] Image post-processing (vignette overlay, color correction toward palette)
- [ ] Keyboard shortcuts for rapid approve/reject workflow
- [ ] Undo/redo for approvals

### Phase 5: Advanced Features

- [ ] Style variant support (surreal_softmagic_v2, _night, _feycourt, etc.)
- [ ] Side-by-side comparison of same scene across style variants
- [ ] Cost tracking dashboard (total API spend)
- [ ] Template prompts for common room types (forest clearing, cave, town square)
- [ ] Import existing images (skip generation for hand-crafted assets)

---

## MUD Server Changes (AmbonMUD repo)

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

## Image Generation Model Research

### Research Spike Plan

Before committing to a model, run a comparison test:

1. Take 5-6 room descriptions from `pbrae.yaml` spanning different vibes:
   - `mountain_summit` (dramatic landscape)
   - `kitchen_main` (cozy domestic)
   - `braelynn_penguin_palace` (whimsical fantasy)
   - `peanut_nether` (dark game world)
   - `coop_henhouse` (warm farmyard)
   - `forest_trail` (nature)

2. Use Claude to generate optimized prompts for each (with style guide suffix)

3. Send the same prompts to 2-3 candidate models

4. Compare on:
   - Style consistency across the batch
   - Adherence to the Surreal Gentle Magic aesthetic
   - Quality at target resolution
   - Color palette compliance (lavender, pale blue, dusty rose, moss green, soft gold)
   - Cost per image
   - API ease of use
   - Generation speed

5. Document findings and select primary model

### Transparency Research

For Phase 2 (mob sprites), separately evaluate:
- Which models handle "transparent background" prompts natively
- Background removal post-processing quality (rembg library, remove.bg API)
- Whether generating on a solid color + removing produces better results than native transparency

---

## Reference Material

The following documents from the AmbonMUD repo should be copied to or referenced from the Visualize repo:

| Document | Purpose | Copy to Visualize? |
|----------|---------|-------------------|
| `docs/STYLE_GUIDE.md` | Full Surreal Gentle Magic design system, color palette, prompt template | **Yes** — primary reference for prompt generation |
| `docs/WORLD_YAML_SPEC.md` | Zone YAML schema for parser implementation | **Yes** — needed for YAML parsing |
| `src/main/resources/world/pbrae.yaml` | First test zone | **Yes** — initial test data |
| `docs/GMCP_PROTOCOL.md` | GMCP package definitions (for understanding integration points) | No — reference only |
| `web-v3/src/styles.css` | Design tokens for the Visualize app's own UI | **Yes** — port tokens |

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
