# AmbonMUD-Visualize

A desktop application for generating style-consistent images for [AmbonMUD](https://github.com/johnnoecker/AmbonMUD) zones. It uses Claude to transform zone YAML descriptions into optimized image generation prompts, then calls DALL-E 3 to produce assets conforming to the **Surreal Gentle Magic** (`surreal_softmagic_v1`) design system.

## How It Works

```
Zone YAML → Claude API (prompt builder) → DALL-E 3 → Asset Library → Export
```

1. **Import** a zone YAML file (rooms, mobs, items)
2. **Generate a zone vibe** — Claude reads all room descriptions and produces a 2-3 sentence atmosphere summary
3. **Generate prompts** — Claude creates an optimized image prompt per entity, incorporating the style guide and zone vibe
4. **Generate images** — DALL-E 3 produces images; regenerate for more variants
5. **Approve** the best variant for each entity
6. **Export** — writes `image:` fields into the zone YAML and copies approved PNGs to the world directory

### Asset Specs

| Type | Aspect | Size | Format |
|------|--------|------|--------|
| Room backgrounds | 16:9 landscape | 1792 x 1024 | PNG |
| Mob sprites | 1:1 square | 1024 x 1024 | PNG |
| Item icons | 1:1 square | 1024 x 1024 | PNG |

## Tech Stack

- **Desktop:** Tauri 2
- **Frontend:** React 19 + TypeScript + Vite
- **Package manager:** Bun
- **Styling:** CSS design tokens (Surreal Gentle Magic dark theme)
- **LLM:** Anthropic Claude via `@anthropic-ai/sdk`
- **Image gen:** OpenAI DALL-E 3 via `openai`
- **State:** React Context + local JSON project files

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (for Tauri)
- [Bun](https://bun.sh/)
- An Anthropic API key (for prompt generation)
- An OpenAI API key (for DALL-E 3 image generation)

### Install & Run

```bash
bun install
bun run tauri dev
```

API keys are configured in the Settings dialog (`Ctrl+,`).

### Build

```bash
bun run tauri build
```

## Project Structure

```
src/
├── components/
│   ├── detail/        # Image preview, prompt editor, action bar, variant strip
│   ├── dialogs/       # New project, settings, batch, export, welcome
│   ├── layout/        # App shell, title bar, status bar
│   ├── sidebar/       # Entity tree, zone vibe panel
│   └── shared/        # StatusIcon
├── context/           # ProjectContext, GenerationContext, SettingsContext
├── lib/               # YAML parser, prompt gen, image gen, export, batch, I/O
├── types/             # TypeScript interfaces (entities, project, settings)
└── styles/            # CSS tokens, animations, reset
src-tauri/             # Tauri (Rust) desktop wrapper
reference/             # Design docs, style guide, sample zone YAMLs
```

## Features

- **Multi-zone projects** — import multiple YAML files into one project
- **Prompt editing** — tweak Claude-generated prompts before image generation
- **Variant management** — generate multiple variants, browse history, approve the best
- **Batch generation** — generate all entities concurrently with progress tracking
- **Batch approve** — auto-approve single-variant entities
- **Default images** — generate fallback room/mob/item images per zone
- **Export** — injects `image:` fields into zone YAML and copies PNGs to the world directory
- **Image reconciliation** — recovers untracked variants from disk on project open
- **Content policy handling** — gracefully handles DALL-E 3 safety rejections

## Design System

The app UI uses the same **Surreal Gentle Magic** aesthetic as the MUD client:

- Lavender, pale blue, dusty rose, moss green, soft gold palette on deep mist backgrounds
- Cormorant Garamond (titles), Nunito Sans (body), JetBrains Mono (code)
- Soft ambient lighting, gentle curves, no harsh edges or neon colors

## Sample Zones

Three test zones are included in `reference/`:

- **pbrae.yaml** — Castle PBrae (55 rooms, family castle)
- **wesleyalis.yaml** — Kingdom of Wesleyalis (31 rooms, treehouse/jungle/dinosaur)
- **trailey.yaml** — Trailey (27 rooms, spy house/HOA/kids' zones)

## License

Private / in-house tool for AmbonMUD.
