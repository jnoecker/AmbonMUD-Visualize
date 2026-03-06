import type { Entity } from "../types/entities";
import type { AssetEntry } from "../types/project";

export interface BatchProgress {
  total: number;
  completed: number;
  currentEntity: string | null;
  errors: Array<{ entityId: string; error: string }>;
}

export interface BatchOptions {
  entities: Entity[];
  assets: Record<string, AssetEntry>;
  zoneVibe: string;
  concurrency: number;
  skipGenerated: boolean;
  generatePrompt: (entity: Entity, vibe: string) => Promise<string>;
  generateImage: (prompt: string, entity: Entity) => Promise<{ bytes: Uint8Array; bgRemovalFailed: boolean }>;
  onSaveImage: (entityId: string, data: Uint8Array, prompt: string) => Promise<void>;
  onProgress: (progress: BatchProgress) => void;
  abortSignal?: AbortSignal;
}

export async function runBatch(options: BatchOptions): Promise<BatchProgress> {
  const {
    entities,
    assets,
    zoneVibe,
    concurrency,
    skipGenerated,
    generatePrompt,
    generateImage,
    onSaveImage,
    onProgress,
    abortSignal,
  } = options;

  // Filter entities based on options
  const toProcess = entities.filter((entity) => {
    const asset = assets[entity.id];
    if (!asset) return true;
    if (skipGenerated && asset.variants.length > 0) return false;
    return true;
  });

  const progress: BatchProgress = {
    total: toProcess.length,
    completed: 0,
    currentEntity: null,
    errors: [],
  };

  onProgress({ ...progress });

  // Process with concurrency limit
  let index = 0;

  async function processNext(): Promise<void> {
    while (index < toProcess.length) {
      if (abortSignal?.aborted) return;

      const entity = toProcess[index++];
      progress.currentEntity = entity.title;
      onProgress({ ...progress });

      let succeeded = false;
      let generatedPrompt: string | null = null;
      let generatedImage: { bytes: Uint8Array; bgRemovalFailed: boolean } | null = null;
      for (let attempt = 0; attempt < 2 && !succeeded; attempt++) {
        try {
          // Generate prompt if needed (reuse from previous attempt if available)
          if (!generatedPrompt) {
            const asset = assets[entity.id];
            generatedPrompt = asset?.currentPrompt ?? null;
            if (!generatedPrompt) {
              generatedPrompt = await generatePrompt(entity, zoneVibe);
            }
          }

          if (abortSignal?.aborted) return;

          // Generate image (reuse from previous attempt if available)
          if (!generatedImage) {
            generatedImage = await generateImage(generatedPrompt, entity);
          }

          if (abortSignal?.aborted) return;

          // Save
          await onSaveImage(entity.id, generatedImage.bytes, generatedPrompt);
          succeeded = true;
        } catch (err) {
          if (attempt === 1) {
            progress.errors.push({
              entityId: entity.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      progress.completed++;
      onProgress({ ...progress });
    }
  }

  // Launch concurrent workers
  const workers = Array.from(
    { length: Math.min(concurrency, toProcess.length) },
    () => processNext()
  );

  await Promise.all(workers);

  progress.currentEntity = null;
  onProgress({ ...progress });

  return progress;
}
