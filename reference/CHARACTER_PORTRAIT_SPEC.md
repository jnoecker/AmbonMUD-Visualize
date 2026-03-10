# Character Creation Portraits Spec

## Overview

Cinematic 2:3 portrait-orientation images for the character creation screen's race and class selection UI. These are polished, atmospheric "movie poster" style portraits — not small sprites.

## Asset Specs

| Property | Value |
|----------|-------|
| Orientation | 2:3 portrait |
| Generation size | 768 x 1152 |
| Output format | JPEG (quality 85%) |
| Background removal | None (opaque) |
| Model | FLUX Dev (`runware:101@1`) |

## Portrait Types

### Race Portraits (12)

One per race. Shows the race's essence in a cinematic close-up to mid-shot, set in an environment that evokes their nature. No class outfit — just the race's natural form.

ID format: `portrait_race_{race}`

### Class Portraits (10)

One per class. Shows an **Archae** (the vanilla humanoid race) wearing the class outfit in an atmospheric action/mood scene. Sells the class fantasy.

ID format: `portrait_class_{class}`

### Total: 22 portraits

At ~$0.003/image (FLUX Dev): **~$0.07 for the full set**

## Prompt Pipeline

### Step 1: Generate Zone Vibe
Standard vibe generation from the portrait zone's room descriptions.

### Step 2: Generate Portrait Prompt Template
Single Claude call produces:
- `raceTemplate` — prompt template with `{race_description}` placeholder
- `classTemplate` — prompt template with `{race_description}`, `{class_outfit}` placeholders
- `raceDescriptions` — per-race prompt fragments
- `classOutfits` — per-class outfit/weapon fragments

### Step 3: Fill & Generate
For each portrait:
1. Fill template via string substitution
2. Append standard Surreal Gentle Magic style suffix
3. Send to Runware FLUX Dev
4. Save as JPEG variant

### Step 4: Curate
User reviews portraits, regenerates any that look off, approves final versions.

## Zone YAML Structure

```yaml
zone: character_portraits
startRoom: gallery

rooms:
  gallery:
    title: "Portrait Gallery"
    description: "..."
    exits:
      n: class_hall
  class_hall:
    title: "Hall of Callings"
    description: "..."
    exits:
      s: gallery

mobs:
  portrait_race_archae:
    title: "Archae"
    description: "An androgynous Archae humanoid..."
    tier: weak
  # ... 11 more races ...

  portrait_class_bulwark:
    title: "Bulwark"
    description: "An androgynous Archae in heavy plate armor..."
    tier: weak
  # ... 9 more classes ...
```

## Auto-Detection

The portrait zone is auto-detected when >80% of mob entity IDs match the regex:
```
/(?:^|:)portrait_(race|class)_([a-z]+)$/
```

## UI Layout

Two sections in the portrait grid:
- **Race Portraits** — horizontal row of 12 portrait cards
- **Class Portraits** — horizontal row of 10 portrait cards

Cards show 2:3 thumbnails with race/class label below. Click opens detail panel with full-size preview, variant strip, prompt editor, and generate/approve actions.

## Files

| File | Purpose |
|------|---------|
| `src/types/portraits.ts` | PortraitConfig, PortraitPromptTemplate, PortraitDimensions |
| `src/lib/portrait-parser.ts` | detectPortraitZone(), parsePortraitId() |
| `src/lib/portrait-prompt-gen.ts` | generatePortraitTemplate(), fillPortraitTemplate() |
| `src/components/portraits/PortraitGrid.tsx` | Main grid with race/class sections |
| `src/components/portraits/PortraitCell.tsx` | Individual portrait thumbnail card |
| `src/components/portraits/PortraitDetailPanel.tsx` | Full-size detail view |
| `src/components/portraits/PortraitBatchBar.tsx` | Batch generation controls |
| `reference/character_portraits.yaml` | Zone YAML with 22 portrait entities |
