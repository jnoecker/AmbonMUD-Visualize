import { useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { useGeneration } from "../../context/GenerationContext";
import type { VideoAssetEntry, VideoConfig, VideoAssetType } from "../../types/video";
import type { Entity } from "../../types/entities";

interface ZoneVideoPanelProps {
  zoneKey: string;
  zoneName: string;
  vibe: string | null;
  entities: Entity[];
}

export function ZoneVideoPanel({
  zoneKey,
  zoneName,
  vibe,
  entities,
}: ZoneVideoPanelProps) {
  const {
    getVideoAssets,
    addVideoAsset,
    updateVideoConfig,
    approveVideoVariant,
    getVideoDataUrl,
    getAsset,
    getImageDataUrl,
  } = useProject();
  const { settings } = useSettings();
  const {
    startVideoConfigGeneration,
    startVideoGeneration,
    getJob,
    getError,
    clearError,
  } = useGeneration();

  const videoAssets = getVideoAssets(zoneKey);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Entities that have an approved image and can be used as video sources
  const bossMobs = entities.filter((e) => {
    if (e.type !== "mob") return false;
    const raw = e.rawYaml as Record<string, unknown>;
    const tier = raw.tier as string | undefined;
    return tier === "boss" || tier === "elite";
  });
  const allMobs = entities.filter((e) => e.type === "mob");
  const allItems = entities.filter((e) => e.type === "item");
  const rooms = entities.filter((e) => e.type === "room");

  const handleAddVideo = async (videoType: VideoAssetType, sourceEntity: Entity | null) => {
    const labels: Record<VideoAssetType, string> = {
      zone_intro: "Zone Intro",
      boss_reveal: "Boss Reveal",
      item_reveal: "Item Reveal",
    };
    const title = sourceEntity
      ? `${labels[videoType]}: ${sourceEntity.title}`
      : labels[videoType];
    await addVideoAsset(zoneKey, title, videoType, sourceEntity?.id ?? null);
    setShowAddMenu(false);
  };

  // Group by type
  const intros = videoAssets.filter((v) => v.videoType === "zone_intro");
  const bossReveals = videoAssets.filter((v) => v.videoType === "boss_reveal");
  const itemReveals = videoAssets.filter((v) => v.videoType === "item_reveal");

  return (
    <div className="glass-panel" style={{ marginBottom: "var(--space-3)" }}>
      <div className="glass-panel-header">
        <span className="glass-panel-title">Zone Video</span>
        <div style={{ position: "relative" }}>
          <button
            className="soft-button soft-button--small"
            onClick={() => setShowAddMenu(!showAddMenu)}
          >
            + Add Video
          </button>
          {showAddMenu && (
            <div className="music-add-menu">
              <button onClick={() => handleAddVideo("zone_intro", rooms[0] ?? null)}>
                Zone Intro Cinematic
              </button>
              {(bossMobs.length > 0 || allMobs.length > 0) && (
                <>
                  <div className="music-add-menu-divider" />
                  <div className="music-add-menu-label">Boss / Elite Reveals</div>
                  {(bossMobs.length > 0 ? bossMobs : allMobs).map((mob) => (
                    <button key={mob.id} onClick={() => handleAddVideo("boss_reveal", mob)}>
                      {mob.title}
                    </button>
                  ))}
                </>
              )}
              {allItems.length > 0 && (
                <>
                  <div className="music-add-menu-divider" />
                  <div className="music-add-menu-label">Item Reveals</div>
                  {allItems.map((item) => (
                    <button key={item.id} onClick={() => handleAddVideo("item_reveal", item)}>
                      {item.title}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {videoAssets.length === 0 ? (
        <div style={{ color: "var(--text-disabled)", fontSize: "0.85rem", padding: "var(--space-2) 0" }}>
          No videos yet. Add one to generate cinematics for this zone.
        </div>
      ) : (
        <div className="music-track-list">
          {intros.map((video) => (
            <VideoCard
              key={video.id}
              zoneKey={zoneKey}
              zoneName={zoneName}
              vibe={vibe}
              video={video}
              entities={entities}
              settings={settings}
              updateVideoConfig={updateVideoConfig}
              approveVideoVariant={approveVideoVariant}
              getVideoDataUrl={getVideoDataUrl}
              getAsset={getAsset}
              getImageDataUrl={getImageDataUrl}
              startVideoConfigGeneration={startVideoConfigGeneration}
              startVideoGeneration={startVideoGeneration}
              getJob={getJob}
              getError={getError}
              clearError={clearError}
            />
          ))}
          {bossReveals.length > 0 && (
            <>
              <div className="music-section-label">Boss Reveals</div>
              {bossReveals.map((video) => (
                <VideoCard
                  key={video.id}
                  zoneKey={zoneKey}
                  zoneName={zoneName}
                  vibe={vibe}
                  video={video}
                  entities={entities}
                  settings={settings}
                  updateVideoConfig={updateVideoConfig}
                  approveVideoVariant={approveVideoVariant}
                  getVideoDataUrl={getVideoDataUrl}
                  getAsset={getAsset}
                  getImageDataUrl={getImageDataUrl}
                  startVideoConfigGeneration={startVideoConfigGeneration}
                  startVideoGeneration={startVideoGeneration}
                  getJob={getJob}
                  getError={getError}
                  clearError={clearError}
                />
              ))}
            </>
          )}
          {itemReveals.length > 0 && (
            <>
              <div className="music-section-label">Item Reveals</div>
              {itemReveals.map((video) => (
                <VideoCard
                  key={video.id}
                  zoneKey={zoneKey}
                  zoneName={zoneName}
                  vibe={vibe}
                  video={video}
                  entities={entities}
                  settings={settings}
                  updateVideoConfig={updateVideoConfig}
                  approveVideoVariant={approveVideoVariant}
                  getVideoDataUrl={getVideoDataUrl}
                  getAsset={getAsset}
                  getImageDataUrl={getImageDataUrl}
                  startVideoConfigGeneration={startVideoConfigGeneration}
                  startVideoGeneration={startVideoGeneration}
                  getJob={getJob}
                  getError={getError}
                  clearError={clearError}
                />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface VideoCardProps {
  zoneKey: string;
  zoneName: string;
  vibe: string | null;
  video: VideoAssetEntry;
  entities: Entity[];
  settings: { runwareApiKey?: string };
  updateVideoConfig: (zoneKey: string, videoId: string, config: VideoConfig) => Promise<void>;
  approveVideoVariant: (zoneKey: string, videoId: string, variantIndex: number) => Promise<void>;
  getVideoDataUrl: (zoneKey: string, videoId: string, filename: string) => Promise<string>;
  getAsset: (zoneKey: string, entityId: string) => { approvedVariantIndex: number | null; variants: { filename: string }[] } | undefined;
  getImageDataUrl: (zoneKey: string, entityId: string, filename: string) => Promise<string>;
  startVideoConfigGeneration: (
    zoneKey: string,
    videoId: string,
    videoType: VideoAssetType,
    entityTitle: string,
    entityDescription: string,
    zoneVibe: string | null
  ) => void;
  startVideoGeneration: (
    zoneKey: string,
    videoId: string,
    config: VideoConfig,
    videoType: VideoAssetType,
    sourceImageBase64: string | null
  ) => void;
  getJob: (zoneKey: string, entityId: string) => { type: string } | undefined;
  getError: (zoneKey: string, entityId: string) => string | undefined;
  clearError: (zoneKey: string, entityId: string) => void;
}

function VideoCard({
  zoneKey,
  zoneName,
  vibe,
  video,
  entities,
  settings,
  updateVideoConfig,
  approveVideoVariant,
  getVideoDataUrl,
  getAsset,
  getImageDataUrl,
  startVideoConfigGeneration,
  startVideoGeneration,
  getJob,
  getError,
  clearError,
}: VideoCardProps) {
  const jobKey = `video:${video.id}`;
  const job = getJob(zoneKey, jobKey);
  const error = getError(zoneKey, jobKey);
  const generatingConfig = job?.type === "prompt";
  const generatingVideo = job?.type === "image";

  const [viewingVariant, setViewingVariant] = useState(
    video.approvedVariantIndex ?? (video.variants.length > 0 ? video.variants.length - 1 : -1)
  );
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [sourceImageB64, setSourceImageB64] = useState<string | null>(null);

  const currentVariant = viewingVariant >= 0 ? video.variants[viewingVariant] : undefined;

  // Load video for current variant
  useEffect(() => {
    if (!currentVariant) {
      setVideoSrc(null);
      return;
    }
    let cancelled = false;
    getVideoDataUrl(zoneKey, video.id, currentVariant.filename).then((url) => {
      if (!cancelled) setVideoSrc(url);
    });
    return () => { cancelled = true; };
  }, [zoneKey, video.id, currentVariant, getVideoDataUrl]);

  // Auto-select latest variant
  useEffect(() => {
    if (video.variants.length > 0 && viewingVariant < 0) {
      setViewingVariant(video.variants.length - 1);
    }
  }, [video.variants.length, viewingVariant]);

  // Load source entity's approved image as base64 for image-to-video
  useEffect(() => {
    if (!video.sourceEntityId) {
      setSourceImageB64(null);
      return;
    }
    const asset = getAsset(zoneKey, video.sourceEntityId);
    if (!asset || asset.approvedVariantIndex === null) {
      setSourceImageB64(null);
      return;
    }
    const variant = asset.variants[asset.approvedVariantIndex];
    if (!variant) {
      setSourceImageB64(null);
      return;
    }
    let cancelled = false;
    getImageDataUrl(zoneKey, video.sourceEntityId, variant.filename).then((url) => {
      if (!cancelled) setSourceImageB64(url);
    });
    return () => { cancelled = true; };
  }, [zoneKey, video.sourceEntityId, getAsset, getImageDataUrl]);

  const sourceEntity = video.sourceEntityId
    ? entities.find((e) => e.id === video.sourceEntityId)
    : null;
  const hasApprovedSource = video.sourceEntityId
    ? (() => {
        const asset = getAsset(zoneKey, video.sourceEntityId);
        return asset?.approvedVariantIndex !== null && asset?.approvedVariantIndex !== undefined;
      })()
    : true; // zone intros without a source still work (text-to-video)

  const handleGenerateConfig = () => {
    clearError(zoneKey, jobKey);
    startVideoConfigGeneration(
      zoneKey,
      video.id,
      video.videoType,
      sourceEntity?.title ?? zoneName,
      sourceEntity?.description ?? "",
      vibe
    );
  };

  const handleGenerateVideo = () => {
    if (!settings.runwareApiKey || !video.currentConfig) return;
    clearError(zoneKey, jobKey);
    startVideoGeneration(
      zoneKey,
      video.id,
      video.currentConfig,
      video.videoType,
      sourceImageB64
    );
  };

  const handleApprove = () => {
    if (viewingVariant >= 0) {
      approveVideoVariant(zoneKey, video.id, viewingVariant);
    }
  };

  const handleEditPrompt = () => {
    setPromptText(video.currentConfig?.prompt ?? "");
    setEditingPrompt(true);
  };

  const handleSavePrompt = async () => {
    await updateVideoConfig(zoneKey, video.id, {
      prompt: promptText,
      duration: 5,
      sourceEntityId: video.sourceEntityId,
    });
    setEditingPrompt(false);
  };

  const typeLabels: Record<VideoAssetType, string> = {
    zone_intro: "intro",
    boss_reveal: "boss",
    item_reveal: "item",
  };

  return (
    <div className={`music-track-card${video.status === "approved" ? " music-track-card--approved" : ""}`}>
      <div className="music-track-header">
        <div>
          <span className="music-track-title">{video.title}</span>
          <span className={`music-track-type video-track-type--${video.videoType}`}>
            {typeLabels[video.videoType]}
          </span>
        </div>
        <span className={`music-track-status music-track-status--${video.status}`}>
          {video.status}
        </span>
      </div>

      {!hasApprovedSource && video.sourceEntityId && (
        <div className="video-source-warning">
          Source entity has no approved image. Approve an image first for image-to-video.
        </div>
      )}

      {video.currentConfig && !editingPrompt && (
        <div className="music-config-summary" onClick={handleEditPrompt} title="Click to edit">
          <div className="music-prompt-text">{video.currentConfig.prompt}</div>
          <div className="music-config-meta">5s &middot; {hasApprovedSource && video.sourceEntityId ? "img2vid" : "txt2vid"}</div>
        </div>
      )}

      {editingPrompt && (
        <div className="music-config-editor">
          <textarea
            className="prompt-textarea"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={4}
          />
          <div className="music-config-editor-actions">
            <button className="soft-button soft-button--small soft-button--primary" onClick={handleSavePrompt}>
              Save
            </button>
            <button className="soft-button soft-button--small" onClick={() => setEditingPrompt(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {videoSrc && (
        <div className="video-player">
          <video
            controls
            src={videoSrc}
            style={{ width: "100%", borderRadius: 6 }}
          />
        </div>
      )}

      {video.variants.length > 1 && (
        <div className="music-variant-strip">
          {video.variants.map((v, i) => (
            <button
              key={v.filename}
              className={`music-variant-btn${i === viewingVariant ? " music-variant-btn--active" : ""}${i === video.approvedVariantIndex ? " music-variant-btn--approved" : ""}`}
              onClick={() => setViewingVariant(i)}
            >
              v{i + 1}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="music-error">{error}</div>
      )}

      <div className="music-track-actions">
        <button
          className="soft-button soft-button--small soft-button--primary"
          onClick={handleGenerateConfig}
          disabled={generatingConfig}
        >
          {generatingConfig ? "Generating..." : video.currentConfig ? "Regen Prompt" : "Generate Prompt"}
        </button>

        {video.currentConfig && (
          <button
            className="soft-button soft-button--small"
            onClick={handleGenerateVideo}
            disabled={generatingVideo || !settings.runwareApiKey}
            title={!settings.runwareApiKey ? "Set Runware API key in Settings" : undefined}
          >
            {generatingVideo ? "Generating..." : "Generate Video"}
          </button>
        )}

        {currentVariant && video.approvedVariantIndex !== viewingVariant && (
          <button
            className="soft-button soft-button--small"
            onClick={handleApprove}
          >
            Approve
          </button>
        )}
      </div>
    </div>
  );
}
