import type { EntityType } from "../../types/entities";

interface ImagePreviewProps {
  src: string | null;
  entityType: EntityType;
  loading?: boolean;
}

export function ImagePreview({ src, entityType, loading }: ImagePreviewProps) {
  const isSquare = entityType !== "room";

  return (
    <div className={`image-preview${isSquare ? " image-preview--square" : ""}`}>
      {loading ? (
        <div className="image-preview-placeholder">
          <div className="image-shimmer" />
          <div className="image-placeholder-content">
            <div className="spinner" />
            <p>Generating image...</p>
          </div>
        </div>
      ) : src ? (
        <img src={src} alt="Generated preview" />
      ) : (
        <div className="image-preview-placeholder">
          <div className="image-placeholder-content">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.3">
              <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
              <circle cx="17" cy="21" r="3" stroke="currentColor" strokeWidth="2" />
              <path d="M6 32l10-8 6 5 8-10 12 13" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            <p>No image generated yet</p>
          </div>
        </div>
      )}
    </div>
  );
}
