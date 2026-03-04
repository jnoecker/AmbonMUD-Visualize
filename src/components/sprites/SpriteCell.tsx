import { useEffect, useState } from "react";
import type { AssetEntry } from "../../types/project";

interface SpriteCellProps {
  entityId: string;
  asset: AssetEntry | undefined;
  race: string;
  selected: boolean;
  generating: boolean;
  onClick: () => void;
  getDataUrl: (entityId: string, filename: string) => Promise<string>;
}

export function SpriteCell({
  entityId,
  asset,
  race,
  selected,
  generating,
  onClick,
  getDataUrl,
}: SpriteCellProps) {
  const [src, setSrc] = useState<string | null>(null);

  // Show the approved variant, or the latest variant
  const displayVariant = asset
    ? asset.approvedVariantIndex !== null
      ? asset.variants[asset.approvedVariantIndex]
      : asset.variants[asset.variants.length - 1]
    : undefined;

  useEffect(() => {
    if (!displayVariant) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    getDataUrl(entityId, displayVariant.filename).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => { cancelled = true; };
  }, [entityId, displayVariant, getDataUrl]);

  const status = asset?.status ?? "pending";

  const cls = [
    "sprite-cell",
    selected && "sprite-cell--selected",
    status === "approved" && "sprite-cell--approved",
    generating && "sprite-cell--generating",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} onClick={onClick} title={asset?.title || entityId}>
      <div className="sprite-cell-image">
        {generating && !src ? (
          <div className="spinner spinner--small" />
        ) : src ? (
          <img src={src} alt={asset?.title || entityId} />
        ) : (
          <div className="sprite-cell-empty">
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none" opacity="0.25">
              <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
              <circle cx="17" cy="21" r="3" stroke="currentColor" strokeWidth="2" />
              <path d="M6 32l10-8 6 5 8-10 12 13" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {generating && src && (
          <div className="sprite-cell-generating-overlay">
            <div className="spinner spinner--small" />
          </div>
        )}
      </div>
      <div className="sprite-cell-label">{capitalize(race)}</div>
      {status !== "pending" && (
        <div className={`sprite-cell-status sprite-cell-status--${status}`} />
      )}
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
