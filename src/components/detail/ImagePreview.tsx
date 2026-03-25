import { useEffect, useRef, useState } from "react";
import type { EntityType } from "../../types/entities";

interface ImagePreviewProps {
  src: string | null;
  entityType: EntityType;
  loading?: boolean;
}

export function ImagePreview({ src, entityType, loading }: ImagePreviewProps) {
  const isSquare = entityType !== "room";
  const [revealing, setRevealing] = useState(false);
  const prevSrcRef = useRef<string | null>(null);

  // Detect when src transitions from null/different to a new value → trigger reveal
  useEffect(() => {
    if (src && src !== prevSrcRef.current) {
      // Only animate if we had no image or a different image before
      if (prevSrcRef.current !== src) {
        setRevealing(true);
        const timer = setTimeout(() => setRevealing(false), 700);
        prevSrcRef.current = src;
        return () => clearTimeout(timer);
      }
    }
    if (!src) {
      prevSrcRef.current = null;
    }
  }, [src]);

  return (
    <div className={`image-preview${isSquare ? " image-preview--square" : ""}`}>
      {loading && !src ? (
        <div className="image-preview-placeholder">
          <div className="image-shimmer" />
          <div className="image-placeholder-content">
            <div className="spinner" />
            <p>Generating image...</p>
          </div>
        </div>
      ) : src ? (
        <>
          <div className={`image-reveal-container${revealing ? " image-reveal-container--revealing" : ""}`}>
            <img src={src} alt="Generated preview" />
            {revealing && <div className="image-reveal-glow" />}
          </div>
          {loading && (
            <div className="image-preview-generating-overlay">
              <div className="spinner spinner--small" />
              <span>Generating new variant...</span>
            </div>
          )}
        </>
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
