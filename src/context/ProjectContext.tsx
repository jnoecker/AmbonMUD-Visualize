import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ProjectFile, AssetEntry, ImageVariant, DefaultImageEntry, EntityEdits } from "../types/project";
import type { Entity, EntityType, ParsedZone } from "../types/entities";
import { applyEditsToEntity } from "../lib/entity-edits";
import type { SpritePromptTemplate } from "../types/sprites";
import { detectSpriteZone } from "../lib/sprite-parser";
import {
  createProject,
  createBlankProject,
  openProject,
  saveProject,
  saveImage,
  getImagePath,
  reconcileImages,
  swapEntityImages,
} from "../lib/project-io";
import { parseZone } from "../lib/yaml-parser";
import { readTextFile, readFile, writeFile } from "@tauri-apps/plugin-fs";

function bytesToDataUrl(bytes: Uint8Array, mime = "image/png"): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return `data:${mime};base64,${btoa(parts.join(""))}`;
}

function mimeForFilename(filename: string): string {
  return filename.endsWith(".jpg") ? "image/jpeg" : "image/png";
}

interface ProjectContextValue {
  project: ProjectFile | null;
  projectDir: string | null;
  parsedZones: Record<string, ParsedZone>;
  selectedEntityId: string | null;
  selectedZone: string | null;

  createNewProject: (dir: string, name: string, yamlPaths: string[]) => Promise<void>;
  createNewBlankProject: (dir: string, name: string) => Promise<void>;
  openExistingProject: (dir: string) => Promise<void>;
  reloadProject: () => Promise<void>;
  closeProject: () => void;
  selectEntity: (zoneKey: string, entityId: string) => void;

  updateVibe: (zoneKey: string, vibe: string) => Promise<void>;
  updatePrompt: (zoneKey: string, entityId: string, prompt: string) => Promise<void>;
  addVariant: (
    zoneKey: string,
    entityId: string,
    imageData: Uint8Array,
    prompt: string
  ) => Promise<number>;
  approveVariant: (zoneKey: string, entityId: string, variantIndex: number) => Promise<void>;
  setViewingVariant: (index: number) => void;
  viewingVariantIndex: number;

  updateDefaultImage: (
    zoneKey: string,
    entityType: EntityType,
    imageData: Uint8Array,
    prompt: string
  ) => Promise<void>;
  getDefaultImageDataUrl: (zoneKey: string, entityType: EntityType) => Promise<string | null>;

  batchApprove: () => Promise<number>;

  updateSpriteTemplate: (zoneKey: string, template: SpritePromptTemplate) => Promise<void>;

  addCustomAsset: (
    zoneKey: string,
    title: string,
    description: string,
    entityType: EntityType
  ) => Promise<string>;

  swapVariants: (zoneKey: string, entityIdA: string, entityIdB: string) => Promise<void>;
  replaceVariantImage: (
    zoneKey: string,
    entityId: string,
    variantIndex: number,
    imageData: Uint8Array
  ) => Promise<void>;
  getVariantImageBytes: (zoneKey: string, entityId: string, filename: string) => Promise<Uint8Array>;

  updateEntityField: (
    zoneKey: string,
    entityId: string,
    field: string,
    value: unknown
  ) => Promise<void>;
  getEntityEdits: (zoneKey: string, entityId: string) => EntityEdits | undefined;

  getEntity: (entityId: string) => Entity | undefined;
  getAsset: (zoneKey: string, entityId: string) => AssetEntry | undefined;
  getImageDataUrl: (zoneKey: string, entityId: string, filename: string) => Promise<string>;
  getApprovalCounts: () => { approved: number; total: number };
}

const ProjectCtx = createContext<ProjectContextValue>(null!);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<ProjectFile | null>(null);
  const [projectDir, setProjectDir] = useState<string | null>(null);
  const [parsedZones, setParsedZones] = useState<Record<string, ParsedZone>>({});
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [viewingVariantIndex, setViewingVariantIndex] = useState(0);

  // Refs for latest values (avoid stale closures in concurrent batch operations)
  const projectRef = useRef<ProjectFile | null>(null);
  const projectDirRef = useRef<string | null>(null);

  // In-memory cache: "zone/entityId/filename" -> data URL
  const imageCache = useRef<Map<string, string>>(new Map());

  const cacheKey = (zone: string, entityId: string, filename: string) =>
    `${zone}/${entityId}/${filename}`;

  // Sync helper: updates both state and ref, persists to disk
  const commitProject = useCallback(async (p: ProjectFile) => {
    projectRef.current = p;
    setProject(p);
    const dir = projectDirRef.current;
    if (dir) {
      await saveProject(dir, p);
    }
  }, []);

  const parseAllZones = useCallback(async (proj: ProjectFile) => {
    const parsed: Record<string, ParsedZone> = {};
    let projUpdated = false;
    let updatedProj = { ...proj, zones: { ...proj.zones } };

    for (const zone of Object.values(proj.zones)) {
      try {
        const yamlContent = await readTextFile(zone.sourceYamlPath);
        const parsedZone = parseZone(yamlContent);
        parsed[zone.zoneName] = parsedZone;

        // Auto-detect sprite zones
        if (!zone.spriteConfig) {
          const config = detectSpriteZone(parsedZone.entities);
          if (config) {
            updatedProj.zones[zone.zoneName] = {
              ...updatedProj.zones[zone.zoneName],
              spriteConfig: config,
            };
            projUpdated = true;
          }
        }
      } catch {
        // Zone file might not be accessible
      }
    }

    setParsedZones(parsed);

    // Persist sprite config detection
    if (projUpdated) {
      projectRef.current = updatedProj;
      setProject(updatedProj);
      const dir = projectDirRef.current;
      if (dir) {
        await saveProject(dir, updatedProj);
      }
    }
  }, []);

  const createNewProject = useCallback(
    async (dir: string, name: string, yamlPaths: string[]) => {
      const proj = await createProject(dir, name, yamlPaths);
      projectRef.current = proj;
      projectDirRef.current = dir;
      setProject(proj);
      setProjectDir(dir);
      setSelectedEntityId(null);
      setSelectedZone(null);
      imageCache.current.clear();
      await parseAllZones(proj);
    },
    [parseAllZones]
  );

  const createNewBlankProject = useCallback(
    async (dir: string, name: string) => {
      const proj = await createBlankProject(dir, name);
      projectRef.current = proj;
      projectDirRef.current = dir;
      setProject(proj);
      setProjectDir(dir);
      setSelectedEntityId(null);
      setSelectedZone(null);
      imageCache.current.clear();
      setParsedZones({});
    },
    []
  );

  const openExistingProject = useCallback(
    async (dir: string) => {
      let proj = await openProject(dir);
      proj = await reconcileImages(dir, proj);
      projectRef.current = proj;
      projectDirRef.current = dir;
      setProject(proj);
      setProjectDir(dir);
      setSelectedEntityId(null);
      setSelectedZone(null);
      imageCache.current.clear();
      await parseAllZones(proj);
    },
    [parseAllZones]
  );

  const reloadProject = useCallback(async () => {
    const dir = projectDirRef.current;
    if (!dir) return;
    let proj = await openProject(dir);
    proj = await reconcileImages(dir, proj);
    projectRef.current = proj;
    setProject(proj);
    imageCache.current.clear();
    await parseAllZones(proj);
  }, [parseAllZones]);

  const closeProject = useCallback(() => {
    projectRef.current = null;
    projectDirRef.current = null;
    setProject(null);
    setProjectDir(null);
    setParsedZones({});
    setSelectedEntityId(null);
    setSelectedZone(null);
    imageCache.current.clear();
  }, []);

  const selectEntity = useCallback((zoneKey: string, entityId: string) => {
    setSelectedZone(zoneKey);
    setSelectedEntityId(entityId);
    setViewingVariantIndex(0);
  }, []);

  const updateVibe = useCallback(
    async (zoneKey: string, vibe: string) => {
      const p = projectRef.current;
      if (!p) return;
      const next = {
        ...p,
        zones: {
          ...p.zones,
          [zoneKey]: { ...p.zones[zoneKey], vibe },
        },
      };
      await commitProject(next);
    },
    [commitProject]
  );

  const updatePrompt = useCallback(
    async (zoneKey: string, entityId: string, prompt: string) => {
      const p = projectRef.current;
      if (!p) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;
      const asset = zone.assets[entityId];
      if (!asset) return;

      const next = {
        ...p,
        zones: {
          ...p.zones,
          [zoneKey]: {
            ...zone,
            assets: {
              ...zone.assets,
              [entityId]: { ...asset, currentPrompt: prompt },
            },
          },
        },
      };
      await commitProject(next);
    },
    [commitProject]
  );

  const addVariant = useCallback(
    async (
      zoneKey: string,
      entityId: string,
      imageData: Uint8Array,
      prompt: string
    ): Promise<number> => {
      const p = projectRef.current;
      const dir = projectDirRef.current;
      if (!p || !dir) return 0;
      const zone = p.zones[zoneKey];
      if (!zone) return 0;
      const asset = zone.assets[entityId];
      if (!asset) return 0;

      const ext = asset.entityType === "room" ? "jpg" : "png";
      const filename = await saveImage(dir, zoneKey, entityId, imageData, ext);

      // Cache the data URL immediately from the bytes we already have
      const mime = ext === "jpg" ? "image/jpeg" : "image/png";
      const key = cacheKey(zoneKey, entityId, filename);
      imageCache.current.set(key, bytesToDataUrl(imageData, mime));

      const variant: ImageVariant = {
        filename,
        generatedAt: new Date().toISOString(),
        prompt,
      };

      const updatedAsset: AssetEntry = {
        ...asset,
        currentPrompt: prompt,
        status: asset.status === "pending" ? "generated" : asset.status,
        variants: [...asset.variants, variant],
      };

      // Re-read ref to get latest (another concurrent call may have updated it)
      const latest = projectRef.current!;
      const latestZone = latest.zones[zoneKey];
      const next: ProjectFile = {
        ...latest,
        zones: {
          ...latest.zones,
          [zoneKey]: {
            ...latestZone,
            assets: { ...latestZone.assets, [entityId]: updatedAsset },
          },
        },
      };
      await commitProject(next);

      return updatedAsset.variants.length - 1;
    },
    [commitProject]
  );

  const approveVariant = useCallback(
    async (zoneKey: string, entityId: string, variantIndex: number) => {
      const p = projectRef.current;
      if (!p) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;
      const asset = zone.assets[entityId];
      if (!asset) return;

      const next = {
        ...p,
        zones: {
          ...p.zones,
          [zoneKey]: {
            ...zone,
            assets: {
              ...zone.assets,
              [entityId]: {
                ...asset,
                status: "approved" as const,
                approvedVariantIndex: variantIndex,
              },
            },
          },
        },
      };
      await commitProject(next);
    },
    [commitProject]
  );

  const batchApprove = useCallback(async (): Promise<number> => {
    const p = projectRef.current;
    if (!p) return 0;

    let count = 0;
    let updated = { ...p };

    for (const [zoneKey, zone] of Object.entries(p.zones)) {
      let assetsChanged = false;
      const updatedAssets = { ...zone.assets };

      for (const [entityId, asset] of Object.entries(zone.assets)) {
        if (asset.status !== "approved" && asset.variants.length === 1) {
          updatedAssets[entityId] = {
            ...asset,
            status: "approved" as const,
            approvedVariantIndex: 0,
          };
          assetsChanged = true;
          count++;
        }
      }

      if (assetsChanged) {
        updated = {
          ...updated,
          zones: {
            ...updated.zones,
            [zoneKey]: { ...zone, assets: updatedAssets },
          },
        };
      }
    }

    if (count > 0) {
      await commitProject(updated);
    }
    return count;
  }, [commitProject]);

  const updateSpriteTemplate = useCallback(
    async (zoneKey: string, template: SpritePromptTemplate) => {
      const p = projectRef.current;
      if (!p) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;
      const next = {
        ...p,
        zones: {
          ...p.zones,
          [zoneKey]: { ...zone, spriteTemplate: template },
        },
      };
      await commitProject(next);
    },
    [commitProject]
  );

  const updateDefaultImage = useCallback(
    async (
      zoneKey: string,
      entityType: EntityType,
      imageData: Uint8Array,
      prompt: string
    ) => {
      const p = projectRef.current;
      const dir = projectDirRef.current;
      if (!p || !dir) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;

      const entityId = `default_${entityType}`;
      const ext = entityType === "room" ? "jpg" : "png";
      const filename = await saveImage(dir, zoneKey, entityId, imageData, ext);

      // Cache the data URL
      const key = cacheKey(zoneKey, entityId, filename);
      imageCache.current.set(key, bytesToDataUrl(imageData, mimeForFilename(filename)));

      const emptyEntry: DefaultImageEntry = { prompt: null, filename: null, generatedAt: null };
      const currentDefaults = zone.defaultImages || { room: { ...emptyEntry }, mob: { ...emptyEntry }, item: { ...emptyEntry } };
      const updatedDefaults = {
        ...currentDefaults,
        [entityType]: {
          prompt,
          filename,
          generatedAt: new Date().toISOString(),
        },
      };

      const latest = projectRef.current!;
      const latestZone = latest.zones[zoneKey];
      const next: ProjectFile = {
        ...latest,
        zones: {
          ...latest.zones,
          [zoneKey]: { ...latestZone, defaultImages: updatedDefaults },
        },
      };
      await commitProject(next);
    },
    [commitProject]
  );

  const getDefaultImageDataUrl = useCallback(
    async (zoneKey: string, entityType: EntityType): Promise<string | null> => {
      const p = projectRef.current;
      const dir = projectDirRef.current;
      if (!p || !dir) return null;

      const zone = p.zones[zoneKey];
      if (!zone?.defaultImages) return null;

      const entry = zone.defaultImages[entityType];
      if (!entry?.filename) return null;

      const entityId = `default_${entityType}`;
      const key = cacheKey(zoneKey, entityId, entry.filename);
      const cached = imageCache.current.get(key);
      if (cached) return cached;

      const filePath = await getImagePath(dir, zoneKey, entityId, entry.filename);
      const bytes = await readFile(filePath);
      const dataUrl = bytesToDataUrl(bytes, mimeForFilename(entry.filename));
      imageCache.current.set(key, dataUrl);
      return dataUrl;
    },
    []
  );

  const swapVariants = useCallback(
    async (zoneKey: string, entityIdA: string, entityIdB: string) => {
      const p = projectRef.current;
      const dir = projectDirRef.current;
      if (!p || !dir) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;

      const emptyAsset = (id: string): AssetEntry => ({
        entityId: id, entityType: "mob", title: id,
        status: "pending", currentPrompt: null, variants: [], approvedVariantIndex: null,
      });
      const assetA = zone.assets[entityIdA] ?? emptyAsset(entityIdA);
      const assetB = zone.assets[entityIdB] ?? emptyAsset(entityIdB);

      // Swap image directories on disk
      await swapEntityImages(dir, zoneKey, entityIdA, entityIdB);

      // Swap image data between assets, keeping identity fields in place
      const next: ProjectFile = {
        ...p,
        zones: {
          ...p.zones,
          [zoneKey]: {
            ...zone,
            assets: {
              ...zone.assets,
              [entityIdA]: {
                ...assetA,
                // Take image data from B
                variants: assetB.variants,
                approvedVariantIndex: assetB.approvedVariantIndex,
                status: assetB.status,
                currentPrompt: assetB.currentPrompt,
              },
              [entityIdB]: {
                ...assetB,
                // Take image data from A
                variants: assetA.variants,
                approvedVariantIndex: assetA.approvedVariantIndex,
                status: assetA.status,
                currentPrompt: assetA.currentPrompt,
              },
            },
          },
        },
      };

      // Invalidate image cache for both entities
      for (const key of imageCache.current.keys()) {
        if (key.includes(entityIdA) || key.includes(entityIdB)) {
          imageCache.current.delete(key);
        }
      }

      await commitProject(next);
    },
    [commitProject]
  );

  const replaceVariantImage = useCallback(
    async (
      zoneKey: string,
      entityId: string,
      variantIndex: number,
      imageData: Uint8Array
    ) => {
      const p = projectRef.current;
      const dir = projectDirRef.current;
      if (!p || !dir) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;
      const asset = zone.assets[entityId];
      if (!asset) return;
      const variant = asset.variants[variantIndex];
      if (!variant) return;

      // Overwrite the file on disk
      const filePath = await getImagePath(dir, zoneKey, entityId, variant.filename);
      await writeFile(filePath, imageData);

      // Invalidate cache so next read picks up the new file
      const key = cacheKey(zoneKey, entityId, variant.filename);
      imageCache.current.set(key, bytesToDataUrl(imageData, mimeForFilename(variant.filename)));
    },
    []
  );

  const getVariantImageBytes = useCallback(
    async (zoneKey: string, entityId: string, filename: string): Promise<Uint8Array> => {
      const dir = projectDirRef.current;
      if (!dir) throw new Error("No project open");
      const filePath = await getImagePath(dir, zoneKey, entityId, filename);
      return readFile(filePath);
    },
    []
  );

  const addCustomAsset = useCallback(
    async (
      zoneKey: string,
      title: string,
      description: string,
      entityType: EntityType
    ): Promise<string> => {
      const p = projectRef.current;
      if (!p) return "";
      const zone = p.zones[zoneKey];
      if (!zone) return "";

      const entityId = `custom_${Date.now()}`;
      const asset: AssetEntry = {
        entityId,
        entityType,
        title,
        status: "pending",
        currentPrompt: null,
        variants: [],
        approvedVariantIndex: null,
        customDescription: description,
      };

      const next: ProjectFile = {
        ...p,
        zones: {
          ...p.zones,
          [zoneKey]: {
            ...zone,
            assets: { ...zone.assets, [entityId]: asset },
          },
        },
      };
      await commitProject(next);
      return entityId;
    },
    [commitProject]
  );

  const updateEntityField = useCallback(
    async (zoneKey: string, entityId: string, field: string, value: unknown) => {
      const p = projectRef.current;
      if (!p) return;
      const zone = p.zones[zoneKey];
      if (!zone) return;

      const currentEdits = zone.entityEdits?.[entityId] ?? {};
      const updatedEdits = { ...currentEdits, [field]: value };

      const next: ProjectFile = {
        ...p,
        zones: {
          ...p.zones,
          [zoneKey]: {
            ...zone,
            entityEdits: {
              ...zone.entityEdits,
              [entityId]: updatedEdits,
            },
          },
        },
      };
      await commitProject(next);
    },
    [commitProject]
  );

  const getEntityEdits = useCallback(
    (zoneKey: string, entityId: string): EntityEdits | undefined => {
      return project?.zones[zoneKey]?.entityEdits?.[entityId];
    },
    [project]
  );

  const getEntity = useCallback(
    (entityId: string): Entity | undefined => {
      for (const [zoneKey, zone] of Object.entries(parsedZones)) {
        const entity = zone.entities.find((e) => e.id === entityId);
        if (entity) {
          const edits = projectRef.current?.zones[zoneKey]?.entityEdits?.[entityId];
          return applyEditsToEntity(entity, edits);
        }
      }
      return undefined;
    },
    [parsedZones]
  );

  const getAsset = useCallback(
    (zoneKey: string, entityId: string): AssetEntry | undefined => {
      return project?.zones[zoneKey]?.assets[entityId];
    },
    [project]
  );

  const getImageDataUrl = useCallback(
    async (zoneKey: string, entityId: string, filename: string): Promise<string> => {
      const dir = projectDirRef.current;
      if (!dir) throw new Error("No project open");

      // Check cache first
      const key = cacheKey(zoneKey, entityId, filename);
      const cached = imageCache.current.get(key);
      if (cached) return cached;

      // Read from disk and cache
      const filePath = await getImagePath(dir, zoneKey, entityId, filename);
      const bytes = await readFile(filePath);
      const dataUrl = bytesToDataUrl(bytes, mimeForFilename(filename));
      imageCache.current.set(key, dataUrl);
      return dataUrl;
    },
    []
  );

  const getApprovalCounts = useCallback(() => {
    if (!project) return { approved: 0, total: 0 };
    let approved = 0;
    let total = 0;
    for (const zone of Object.values(project.zones)) {
      for (const asset of Object.values(zone.assets)) {
        total++;
        if (asset.status === "approved") approved++;
      }
    }
    return { approved, total };
  }, [project]);

  return (
    <ProjectCtx.Provider
      value={{
        project,
        projectDir,
        parsedZones,
        selectedEntityId,
        selectedZone,
        createNewProject,
        createNewBlankProject,
        openExistingProject,
        reloadProject,
        closeProject,
        selectEntity,
        updateVibe,
        updatePrompt,
        addVariant,
        approveVariant,
        batchApprove,
        addCustomAsset,
        updateSpriteTemplate,
        updateDefaultImage,
        getDefaultImageDataUrl,
        setViewingVariant: setViewingVariantIndex,
        viewingVariantIndex,
        swapVariants,
        replaceVariantImage,
        getVariantImageBytes,
        updateEntityField,
        getEntityEdits,
        getEntity,
        getAsset,
        getImageDataUrl,
        getApprovalCounts,
      }}
    >
      {children}
    </ProjectCtx.Provider>
  );
}

export function useProject() {
  return useContext(ProjectCtx);
}
