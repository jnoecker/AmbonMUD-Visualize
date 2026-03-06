import { useEffect, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { useSettings } from "../../context/SettingsContext";
import { useGeneration } from "../../context/GenerationContext";
import type { MusicAssetEntry, MusicConfig } from "../../types/music";

interface ZoneMusicPanelProps {
  zoneKey: string;
  zoneName: string;
  vibe: string | null;
  roomDescriptions: string[];
}

export function ZoneMusicPanel({
  zoneKey,
  zoneName,
  vibe,
  roomDescriptions,
}: ZoneMusicPanelProps) {
  const {
    getMusicAssets,
    addMusicAsset,
    updateMusicConfig,
    approveMusicVariant,
    getAudioDataUrl,
  } = useProject();
  const { settings } = useSettings();
  const {
    startMusicConfigGeneration,
    startMusicGeneration,
    getJob,
    getError,
    clearError,
  } = useGeneration();

  const musicAssets = getMusicAssets(zoneKey);

  const handleAddTrack = async () => {
    const title = musicAssets.length === 0 ? "Ambient" : `Ambient ${musicAssets.length + 1}`;
    await addMusicAsset(zoneKey, title);
  };

  return (
    <div className="glass-panel" style={{ marginBottom: "var(--space-3)" }}>
      <div className="glass-panel-header">
        <span className="glass-panel-title">Zone Music</span>
        <button
          className="soft-button soft-button--small"
          onClick={handleAddTrack}
        >
          + Add Track
        </button>
      </div>

      {musicAssets.length === 0 ? (
        <div style={{ color: "var(--text-disabled)", fontSize: "0.85rem", padding: "var(--space-2) 0" }}>
          No music tracks yet. Add one to generate ambient music for this zone.
        </div>
      ) : (
        <div className="music-track-list">
          {musicAssets.map((music) => (
            <MusicTrackCard
              key={music.id}
              zoneKey={zoneKey}
              zoneName={zoneName}
              vibe={vibe}
              roomDescriptions={roomDescriptions}
              music={music}
              settings={settings}
              updateMusicConfig={updateMusicConfig}
              approveMusicVariant={approveMusicVariant}
              getAudioDataUrl={getAudioDataUrl}
              startMusicConfigGeneration={startMusicConfigGeneration}
              startMusicGeneration={startMusicGeneration}
              getJob={getJob}
              getError={getError}
              clearError={clearError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface MusicTrackCardProps {
  zoneKey: string;
  zoneName: string;
  vibe: string | null;
  roomDescriptions: string[];
  music: MusicAssetEntry;
  settings: { anthropicApiKey?: string; runwareApiKey?: string };
  updateMusicConfig: (zoneKey: string, musicId: string, config: MusicConfig) => Promise<void>;
  approveMusicVariant: (zoneKey: string, musicId: string, variantIndex: number) => Promise<void>;
  getAudioDataUrl: (zoneKey: string, musicId: string, filename: string) => Promise<string>;
  startMusicConfigGeneration: (
    zoneKey: string,
    musicId: string,
    zoneName: string,
    vibe: string | null,
    roomDescriptions: string[]
  ) => void;
  startMusicGeneration: (
    zoneKey: string,
    musicId: string,
    config: MusicConfig
  ) => void;
  getJob: (zoneKey: string, entityId: string) => { type: string } | undefined;
  getError: (zoneKey: string, entityId: string) => string | undefined;
  clearError: (zoneKey: string, entityId: string) => void;
}

function MusicTrackCard({
  zoneKey,
  zoneName,
  vibe,
  roomDescriptions,
  music,
  settings,
  updateMusicConfig,
  approveMusicVariant,
  getAudioDataUrl,
  startMusicConfigGeneration,
  startMusicGeneration,
  getJob,
  getError,
  clearError,
}: MusicTrackCardProps) {
  const jobKey = `music:${music.id}`;
  const job = getJob(zoneKey, jobKey);
  const error = getError(zoneKey, jobKey);
  const generatingConfig = job?.type === "prompt";
  const generatingAudio = job?.type === "image";

  const [viewingVariant, setViewingVariant] = useState(
    music.approvedVariantIndex ?? (music.variants.length > 0 ? music.variants.length - 1 : -1)
  );
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [durationValue, setDurationValue] = useState(music.currentConfig?.duration ?? 45);

  const currentVariant = viewingVariant >= 0 ? music.variants[viewingVariant] : undefined;

  // Load audio data URL when variant changes
  useEffect(() => {
    if (!currentVariant) {
      setAudioSrc(null);
      return;
    }
    let cancelled = false;
    getAudioDataUrl(zoneKey, music.id, currentVariant.filename).then((url) => {
      if (!cancelled) setAudioSrc(url);
    });
    return () => { cancelled = true; };
  }, [zoneKey, music.id, currentVariant, getAudioDataUrl]);

  // Update viewing variant when new variants are added
  useEffect(() => {
    if (music.variants.length > 0 && viewingVariant < 0) {
      setViewingVariant(music.variants.length - 1);
    }
  }, [music.variants.length, viewingVariant]);

  const handleGenerateConfig = () => {
    if (!settings.anthropicApiKey) return;
    clearError(zoneKey, jobKey);
    startMusicConfigGeneration(zoneKey, music.id, zoneName, vibe, roomDescriptions);
  };

  const handleGenerateAudio = () => {
    if (!settings.runwareApiKey || !music.currentConfig) return;
    clearError(zoneKey, jobKey);
    // Use the current duration value from the slider
    const config = { ...music.currentConfig, duration: durationValue };
    startMusicGeneration(zoneKey, music.id, config);
  };

  const handleApprove = () => {
    if (viewingVariant >= 0) {
      approveMusicVariant(zoneKey, music.id, viewingVariant);
    }
  };

  const handleEditPrompt = () => {
    setPromptText(music.currentConfig?.prompt ?? "");
    setEditingPrompt(true);
  };

  const handleSavePrompt = async () => {
    await updateMusicConfig(zoneKey, music.id, {
      prompt: promptText,
      duration: durationValue,
    });
    setEditingPrompt(false);
  };

  return (
    <div className={`music-track-card${music.status === "approved" ? " music-track-card--approved" : ""}`}>
      <div className="music-track-header">
        <span className="music-track-title">{music.title}</span>
        <span className={`music-track-status music-track-status--${music.status}`}>
          {music.status}
        </span>
      </div>

      {/* Prompt display/editor */}
      {music.currentConfig && !editingPrompt && (
        <div className="music-config-summary" onClick={handleEditPrompt} title="Click to edit">
          <div className="music-prompt-text">{music.currentConfig.prompt}</div>
          <div className="music-config-meta">{music.currentConfig.duration}s</div>
        </div>
      )}

      {editingPrompt && (
        <div className="music-config-editor">
          <textarea
            className="prompt-textarea"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={6}
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

      {/* Duration slider */}
      {music.currentConfig && (
        <div className="music-duration-control">
          <label className="music-duration-label">
            Duration: {durationValue}s
          </label>
          <input
            type="range"
            min={10}
            max={120}
            step={5}
            value={durationValue}
            onChange={(e) => setDurationValue(Number(e.target.value))}
            className="music-duration-slider"
          />
        </div>
      )}

      {/* Audio player */}
      {audioSrc && (
        <div className="music-player">
          <audio controls src={audioSrc} style={{ width: "100%" }} />
        </div>
      )}

      {/* Variant strip */}
      {music.variants.length > 1 && (
        <div className="music-variant-strip">
          {music.variants.map((v, i) => (
            <button
              key={v.filename}
              className={`music-variant-btn${i === viewingVariant ? " music-variant-btn--active" : ""}${i === music.approvedVariantIndex ? " music-variant-btn--approved" : ""}`}
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

      {/* Actions */}
      <div className="music-track-actions">
        <button
          className="soft-button soft-button--small soft-button--primary"
          onClick={handleGenerateConfig}
          disabled={generatingConfig || !settings.anthropicApiKey}
          title={!settings.anthropicApiKey ? "Set Anthropic API key in Settings" : undefined}
        >
          {generatingConfig ? "Generating..." : music.currentConfig ? "Regen Prompt" : "Generate Prompt"}
        </button>

        {music.currentConfig && (
          <button
            className="soft-button soft-button--small"
            onClick={handleGenerateAudio}
            disabled={generatingAudio || !settings.runwareApiKey}
            title={!settings.runwareApiKey ? "Set Runware API key in Settings" : undefined}
          >
            {generatingAudio ? "Generating..." : "Generate Track"}
          </button>
        )}

        {currentVariant && music.approvedVariantIndex !== viewingVariant && (
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
