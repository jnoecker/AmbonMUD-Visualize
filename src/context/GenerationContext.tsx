import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useProject } from "./ProjectContext";
import { useSettings } from "./SettingsContext";
import { generateEntityPrompt, generateCustomAssetPrompt } from "../lib/prompt-gen";
import { generateAbilityPrompt } from "../lib/ability-prompt-gen";
import { getAbilityFromEntity } from "../lib/ability-parser";
import { generateImage, getAspectRatio, ContentPolicyError } from "../lib/image-gen";
import type { Entity, EntityType } from "../types/entities";

type JobType = "prompt" | "image";

interface GenerationJob {
  type: JobType;
  /** For multi-image jobs: total requested and completed so far. */
  total?: number;
  completed?: number;
}

interface GenerationContextValue {
  startPromptGeneration: (
    zoneKey: string,
    entityId: string,
    entity: Entity,
    zoneVibe: string
  ) => void;
  startCustomPromptGeneration: (
    zoneKey: string,
    entityId: string,
    description: string,
    entityType: EntityType,
    zoneVibe: string | null
  ) => void;
  startImageGeneration: (
    zoneKey: string,
    entityId: string,
    prompt: string,
    entity: Entity
  ) => void;
  startCustomImageGeneration: (
    zoneKey: string,
    entityId: string,
    prompt: string,
    entityType: EntityType
  ) => void;
  startMultiImageGeneration: (
    zoneKey: string,
    entityId: string,
    prompt: string,
    entity: Entity,
    count: number
  ) => void;
  getJob: (zoneKey: string, entityId: string) => GenerationJob | undefined;
  getError: (zoneKey: string, entityId: string) => string | undefined;
  clearError: (zoneKey: string, entityId: string) => void;
}

const GenerationCtx = createContext<GenerationContextValue>(null!);

function entityKey(zoneKey: string, entityId: string) {
  return `${zoneKey}/${entityId}`;
}

export function GenerationProvider({ children }: { children: ReactNode }) {
  const { updatePrompt, addVariant, selectedZone, selectedEntityId, setViewingVariant } =
    useProject();
  const { settings } = useSettings();

  // Using useState with Map for reactivity
  const [jobs, setJobs] = useState<Map<string, GenerationJob>>(new Map());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());

  // Refs to read current selection without stale closures
  const selectedZoneRef = useRef(selectedZone);
  selectedZoneRef.current = selectedZone;
  const selectedEntityIdRef = useRef(selectedEntityId);
  selectedEntityIdRef.current = selectedEntityId;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const setJob = useCallback((key: string, job: GenerationJob) => {
    setJobs((prev) => {
      const next = new Map(prev);
      next.set(key, job);
      return next;
    });
  }, []);

  const removeJob = useCallback((key: string) => {
    setJobs((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const setErrorForKey = useCallback((key: string, msg: string) => {
    setErrors((prev) => {
      const next = new Map(prev);
      next.set(key, msg);
      return next;
    });
  }, []);

  const startPromptGeneration = useCallback(
    (zoneKey: string, entityId: string, entity: Entity, zoneVibe: string) => {
      const key = entityKey(zoneKey, entityId);

      // Clear any previous error
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      setJob(key, { type: "prompt" });

      (async () => {
        try {
          let prompt: string;
          if (entity.type === "ability") {
            const ability = getAbilityFromEntity(entity);
            prompt = await generateAbilityPrompt(
              settingsRef.current.anthropicApiKey!,
              entity,
              ability
            );
          } else {
            prompt = await generateEntityPrompt(
              settingsRef.current.anthropicApiKey!,
              entity,
              zoneVibe
            );
          }
          await updatePrompt(zoneKey, entityId, prompt);
        } catch (err) {
          setErrorForKey(
            key,
            err instanceof Error ? err.message : "Failed to generate prompt"
          );
        } finally {
          removeJob(key);
        }
      })();
    },
    [updatePrompt, setJob, removeJob, setErrorForKey]
  );

  const startCustomPromptGeneration = useCallback(
    (
      zoneKey: string,
      entityId: string,
      description: string,
      entityType: EntityType,
      zoneVibe: string | null
    ) => {
      const key = entityKey(zoneKey, entityId);

      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      setJob(key, { type: "prompt" });

      (async () => {
        try {
          const prompt = await generateCustomAssetPrompt(
            settingsRef.current.anthropicApiKey!,
            description,
            entityType,
            zoneVibe
          );
          await updatePrompt(zoneKey, entityId, prompt);
        } catch (err) {
          setErrorForKey(
            key,
            err instanceof Error ? err.message : "Failed to generate prompt"
          );
        } finally {
          removeJob(key);
        }
      })();
    },
    [updatePrompt, setJob, removeJob, setErrorForKey]
  );

  const startImageGeneration = useCallback(
    (zoneKey: string, entityId: string, prompt: string, entity: Entity) => {
      const key = entityKey(zoneKey, entityId);

      // Clear any previous error
      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      setJob(key, { type: "image" });

      (async () => {
        try {
          const result = await generateImage(
            settingsRef.current.runwareApiKey!,
            prompt,
            {
              aspectRatio: getAspectRatio(entity.type),
              entityType: entity.type,
              removeBackground: settingsRef.current.removeBackground,
            },
            settingsRef.current.runwareModel
          );
          const newIndex = await addVariant(zoneKey, entityId, result.bytes, prompt);

          // Auto-select the new variant only if user is still viewing this entity
          if (
            newIndex !== undefined &&
            selectedZoneRef.current === zoneKey &&
            selectedEntityIdRef.current === entityId
          ) {
            setViewingVariant(newIndex);
          }
          if (result.bgRemovalFailed) {
            setErrorForKey(key, "Image saved, but background removal failed. You can retry it manually.");
          }
        } catch (err) {
          console.error("[image gen] error:", err);
          if (err instanceof ContentPolicyError) {
            setErrorForKey(key, err.message);
          } else {
            const msg = err instanceof Error ? err.message
              : typeof err === "string" ? err
              : `Image generation failed: ${JSON.stringify(err)}`;
            setErrorForKey(key, msg);
          }
        } finally {
          removeJob(key);
        }
      })();
    },
    [addVariant, setViewingVariant, setJob, removeJob, setErrorForKey]
  );

  const startCustomImageGeneration = useCallback(
    (zoneKey: string, entityId: string, prompt: string, entityType: EntityType) => {
      const key = entityKey(zoneKey, entityId);

      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      setJob(key, { type: "image" });

      (async () => {
        try {
          const result = await generateImage(
            settingsRef.current.runwareApiKey!,
            prompt,
            {
              aspectRatio: getAspectRatio(entityType),
              entityType,
              removeBackground: settingsRef.current.removeBackground,
            },
            settingsRef.current.runwareModel
          );
          const newIndex = await addVariant(zoneKey, entityId, result.bytes, prompt);

          if (
            newIndex !== undefined &&
            selectedZoneRef.current === zoneKey &&
            selectedEntityIdRef.current === entityId
          ) {
            setViewingVariant(newIndex);
          }
          if (result.bgRemovalFailed) {
            setErrorForKey(key, "Image saved, but background removal failed. You can retry it manually.");
          }
        } catch (err) {
          console.error("[custom image gen] error:", err);
          if (err instanceof ContentPolicyError) {
            setErrorForKey(key, err.message);
          } else {
            const msg = err instanceof Error ? err.message
              : typeof err === "string" ? err
              : `Image generation failed: ${JSON.stringify(err)}`;
            setErrorForKey(key, msg);
          }
        } finally {
          removeJob(key);
        }
      })();
    },
    [addVariant, setViewingVariant, setJob, removeJob, setErrorForKey]
  );

  const startMultiImageGeneration = useCallback(
    (zoneKey: string, entityId: string, prompt: string, entity: Entity, count: number) => {
      const key = entityKey(zoneKey, entityId);

      setErrors((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });

      setJob(key, { type: "image", total: count, completed: 0 });

      (async () => {
        let completed = 0;
        let lastIndex: number | undefined;
        const errors: string[] = [];

        // Run all generations concurrently
        await Promise.all(
          Array.from({ length: count }, () =>
            (async () => {
              try {
                const result = await generateImage(
                  settingsRef.current.runwareApiKey!,
                  prompt,
                  {
                    aspectRatio: getAspectRatio(entity.type),
                    entityType: entity.type,
                    removeBackground: settingsRef.current.removeBackground,
                  },
                  settingsRef.current.runwareModel
                );
                const newIndex = await addVariant(zoneKey, entityId, result.bytes, prompt);
                lastIndex = newIndex;
                if (result.bgRemovalFailed) {
                  errors.push("Background removal failed on one or more images.");
                }
              } catch (err) {
                if (err instanceof ContentPolicyError) {
                  errors.push(err.message);
                } else {
                  errors.push(err instanceof Error ? err.message : String(err));
                }
              } finally {
                completed++;
                setJob(key, { type: "image", total: count, completed });
              }
            })()
          )
        );

        removeJob(key);

        // Show the last generated variant
        if (
          lastIndex !== undefined &&
          selectedZoneRef.current === zoneKey &&
          selectedEntityIdRef.current === entityId
        ) {
          setViewingVariant(lastIndex);
        }

        if (errors.length > 0) {
          // Deduplicate error messages
          const unique = [...new Set(errors)];
          setErrorForKey(key, unique.join(" "));
        }
      })();
    },
    [addVariant, setViewingVariant, setJob, removeJob, setErrorForKey]
  );

  const getJob = useCallback(
    (zoneKey: string, entityId: string) => {
      return jobs.get(entityKey(zoneKey, entityId));
    },
    [jobs]
  );

  const getError = useCallback(
    (zoneKey: string, entityId: string) => {
      return errors.get(entityKey(zoneKey, entityId));
    },
    [errors]
  );

  const clearError = useCallback(
    (zoneKey: string, entityId: string) => {
      setErrors((prev) => {
        const key = entityKey(zoneKey, entityId);
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    },
    []
  );

  return (
    <GenerationCtx.Provider
      value={{
        startPromptGeneration,
        startCustomPromptGeneration,
        startImageGeneration,
        startCustomImageGeneration,
        startMultiImageGeneration,
        getJob,
        getError,
        clearError,
      }}
    >
      {children}
    </GenerationCtx.Provider>
  );
}

export function useGeneration() {
  return useContext(GenerationCtx);
}
