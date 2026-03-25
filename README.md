# AmbonMUD-Visualize

A desktop application for generating style-consistent images for [AmbonMUD](https://github.com/johnnoecker/AmbonMUD) zones. Loads zone YAML files, uses Claude to craft optimized image prompts, then generates assets via Runware (FLUX models) — all conforming to the **Surreal Gentle Magic** (`surreal_softmagic_v1`) design system.

## How It Works

```
Zone YAML → Claude API (prompt builder) → Runware FLUX (image gen) → Asset Library → Export
```

1. **Import** a zone YAML file (rooms, mobs, items)
2. **Generate a zone vibe** — Claude reads all room descriptions and produces a 2-3 sentence atmosphere summary
3. **Generate prompts** — Claude creates an optimized image prompt per entity, incorporating the style guide and zone vibe
4. **Generate images** — Runware FLUX produces images; regenerate for more variants
5. **Approve** the best variant for each entity
6. **Export** — writes `image:` fields into the zone YAML and copies approved PNGs to the world directory

### Asset Types

| Type | Aspect | Generation Size | Output Size | Format |
|------|--------|-----------------|-------------|--------|
| Room backgrounds | 16:9 landscape | 1024x576 | 1024x576 | PNG |
| Mob sprites | 1:1 square | 1024x1024 | 512x512 | PNG |
| Item icons | 1:1 square | 1024x1024 | 256x256 | PNG |
| Ability icons | 1:1 square | 1024x1024 | 256x256 | PNG |
| Player sprites | 1:1 square | 1024x1024 | 512x512 | PNG |
| Character portraits | 2:3 portrait | 768x1152 | 768x1152 | JPEG |

## Tech Stack

- **Desktop:** Tauri 2 (Rust)
- **Frontend:** React 19 + TypeScript + Vite 7
- **Package manager:** Bun
- **Styling:** CSS design tokens (Surreal Gentle Magic dark theme)
- **LLM:** Anthropic Claude via `@anthropic-ai/sdk`
- **Image gen:** Runware.AI via `@runware/sdk-js` — FLUX Dev (general assets), FLUX 2 (sprites, portraits)
- **Background removal:** `@imgly/background-removal`
- **State:** React Context + local JSON project files

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (for Tauri)
- [Bun](https://bun.sh/)
- A Runware API key (for image generation)
- An Anthropic API key (for prompt generation)

### Install & Run

```bash
bun install
bun run dev        # Vite dev server (browser)
bun run tauri dev  # Tauri native window
```

API keys are configured in the Settings dialog (`Ctrl+,`).

### Build

```bash
bun run build       # Frontend only
bun run tauri build # Native desktop app
```

## Project Structure

```
src/
├── components/
│   ├── abilities/     # Ability icon generation grid
│   ├── detail/        # Image preview, prompt editor, action bar, variant strip
│   ├── dialogs/       # New project, settings, batch, export, welcome, custom asset
│   ├── layout/        # App shell, title bar, status bar
│   ├── music/         # Zone music generation
│   ├── portraits/     # Character creation portrait grid + detail
│   ├── shared/        # AssetCell, EntitySummary, StatusIcon
│   ├── sidebar/       # Entity tree, zone vibe panel
│   ├── sprites/       # Player sprite grid + detail (paper-doll system)
│   └── video/         # Zone video generation
├── context/           # ProjectContext, GenerationContext, SettingsContext
├── hooks/             # Accessibility helpers
├── lib/               # YAML parser, prompt gen, image gen, export, batch, I/O
├── types/             # TypeScript interfaces (entities, project, settings, sprites, etc.)
└── styles/            # CSS tokens, animations, reset
src-tauri/             # Tauri (Rust) desktop wrapper
reference/             # Design docs, style guide, sample zone YAMLs
```

## Features

- **Zone asset generation** — room backgrounds, mob sprites, item icons from zone YAML
- **Prompt editing** — tweak Claude-generated prompts before image generation
- **Variant management** — generate multiple variants, browse history, approve the best
- **Batch generation** — generate all entities concurrently with progress tracking
- **Batch approve** — auto-approve single-variant entities
- **Player sprites** — 384-sprite paper-doll system (12 races x 10 classes x tiers) using FLUX 2
- **Character portraits** — 22 cinematic race/class portraits for character creation
- **Ability icons** — 100 ability icons across 10 classes with class-specific colors
- **Zone music** — ambient music generation per zone
- **Zone video** — cinematic video generation (zone intros, boss reveals)
- **Background removal** — automatic BG removal for sprites and items
- **Default images** — generate fallback room/mob/item images per zone
- **Export** — injects `image:` fields into zone YAML and copies assets to the world directory
- **Image reconciliation** — recovers untracked variants from disk on project open
- **Custom assets** — generate one-off assets outside the zone pipeline
- **Entity field editing** — edit entity descriptions to influence prompt generation

## Design System

The app UI uses the same **Surreal Gentle Magic** aesthetic as the MUD client. See [`reference/STYLE_GUIDE.md`](reference/STYLE_GUIDE.md) for the full design system specification.

- Lavender, pale blue, dusty rose, moss green, soft gold palette on deep mist backgrounds
- Cormorant Garamond (titles), Nunito Sans (body), JetBrains Mono (code)
- Soft ambient lighting, gentle curves, no harsh edges or neon colors

## Sample Zones

Five test zones are included in `reference/`:

- **pbrae.yaml** — Castle PBrae (55 rooms, family castle)
- **wesleyalis.yaml** — Kingdom of Wesleyalis (31 rooms, treehouse/jungle/dinosaur)
- **trailey.yaml** — Trailey (27 rooms, spy house/HOA/kids' zones)
- **player_sprites.yaml** — Player sprite gallery (384 mobs, paper-doll format)
- **character_portraits.yaml** — Character creation portraits (22 mobs)

## Reference Documents

- [`VISUALIZE_EPIC_PLAN.md`](reference/VISUALIZE_EPIC_PLAN.md) — Architecture, prompt pipeline, implementation plan
- [`STYLE_GUIDE.md`](reference/STYLE_GUIDE.md) — Surreal Gentle Magic design system (colors, typography, animation)
- [`WORLD_YAML_SPEC.md`](reference/WORLD_YAML_SPEC.md) — Zone YAML schema for the parser
- [`PLAYER_SPRITE_SPEC.md`](reference/PLAYER_SPRITE_SPEC.md) — Paper-doll sprite system (races, classes, tiers)
- [`CHARACTER_PORTRAIT_SPEC.md`](reference/CHARACTER_PORTRAIT_SPEC.md) — Character creation portrait spec

## License

Private / in-house tool for AmbonMUD.
