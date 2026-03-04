# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

This is an in-house tool — commit and push directly to `main`. No feature branches or PRs needed.

## Project Overview

AmbonMUD-Visualize is a standalone desktop application for generating style-consistent images for AmbonMUD zones. It uses Claude API to transform zone YAML descriptions into optimized image generation prompts, then calls a pluggable image generation API to produce assets conforming to the "Surreal Gentle Magic" (surreal_softmagic_v1) design system.

**Current state:** Pre-implementation. The repo contains only reference documentation from AmbonMUD. Implementation follows the phased plan in `reference/VISUALIZE_EPIC_PLAN.md`.

## Tech Stack

- **Desktop wrapper:** Tauri (preferred over Electron)
- **Frontend:** React + TypeScript + Vite
- **Package manager:** Bun
- **Styling:** CSS design tokens ported from `reference/styles.css` (Surreal Gentle Magic dark-mode theme)
- **YAML parsing:** `js-yaml` or `yaml` npm package (client-side)
- **LLM API:** Anthropic Claude API via `@anthropic-ai/sdk`
- **Image gen:** Runware.AI (FLUX Dev model) via `@runware/sdk-js`
- **State:** React state + local JSON project files (no backend)

## Architecture

```
Zone YAML Parser → Claude API (prompt builder) → Image Gen API (pluggable) → Asset Library → Export
```

Three asset types with different specs:
- **Room backgrounds:** 16:9 landscape, 1920x1080, opaque PNG
- **Mob sprites:** 1:1 square, 512x512, transparent PNG (background removal post-processing)
- **Item icons:** 1:1 square, 256x256, transparent PNG

The app manages "projects" — local directories containing source YAML, generated prompts, image variants, and approval state. Export produces modified zone YAML (with `image:` fields and prompt comments) plus organized image files for the MUD server.

## Reference Documents

All in `reference/`:
- `VISUALIZE_EPIC_PLAN.md` — Full architecture, UI mockups, phased implementation plan, TypeScript interfaces
- `WORLD_YAML_SPEC.md` — Zone YAML schema (rooms, mobs, items, shops, gatheringNodes, recipes, ID normalization rules)
- `STYLE_GUIDE.md` — Complete Surreal Gentle Magic design system (colors, typography, animation, component states)
- `styles.css` — CSS design tokens and component styles to port from web-v3
- `pbrae.yaml`, `wesleyalis.yaml` — Sample zone files for testing the parser

## Design System: Surreal Gentle Magic

The app's own UI must use the same design system as the MUD client.

**Color palette (dark theme):**
- Lavender `#a897d2`, Pale Blue `#8caec9`, Dusty Rose `#b88faa`, Moss Green `#8da97b`, Soft Gold `#bea873`
- Deep Mist `#22293c` (darkest bg), backgrounds `#2a3149`/`#262f47`/`#313a56`

**Fonts (Google Fonts):** Cormorant Garamond (titles), Nunito Sans (UI body), JetBrains Mono (terminal/code)

**Key rules:**
- No neon, no pure black, no saturated primaries, no harsh shadows/edges
- Soft ambient diffused lighting, gentle curves, organic forms
- Easing: `ease-out-soft` for interactions, `ease-in-out-smooth` for transitions
- All colors via CSS variables, never hardcoded

## Image Prompt Engineering

Every image generation prompt must end with the standard style suffix:
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

The prompt pipeline: zone vibe summary (all room descriptions → Claude → 2-3 sentence atmosphere) → per-entity prompt (style guide + zone vibe + entity context → Claude → optimized image prompt).

## Zone YAML Parsing

Key parsing rules (from `WORLD_YAML_SPEC.md`):
- Required top-level: `zone`, `startRoom`, `rooms`
- IDs are normalized: bare IDs get prefixed with `<zone>:`, IDs containing `:` used as-is
- Exit direction keys: n/north, s/south, e/east, w/west, u/up, d/down
- Mob tiers: weak, standard, elite, boss (each with stat formulas)
- Items have optional `slot` (head/body/hand), `consumable`, `onUse`, `basePrice`

## Pluggable Image Generator Interface

```typescript
interface ImageGenerator {
  name: string
  generate(prompt: string, options: GenerateOptions): Promise<GeneratedImage[]>
  supportsTransparency: boolean
}
```

Transparency is typically handled via post-processing (generate on solid color background → background removal).
