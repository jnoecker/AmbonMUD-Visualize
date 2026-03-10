import { useEffect, useState } from "react";
import type { AssetEntry } from "../../types/project";

interface PortraitCellProps {
  entityId: string;
  asset: AssetEntry | undefined;
  label: string;
  selected: boolean;
  generating: boolean;
  onClick: () => void;
  getDataUrl: (entityId: string, filename: string) => Promise<string>;
}

export function PortraitCell({
  entityId,
  asset,
  label,
  selected,
  generating,
  onClick,
  getDataUrl,
}: PortraitCellProps) {
  const [src, setSrc] = useState<string | null>(null);

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
    "portrait-cell",
    selected && "portrait-cell--selected",
    status === "approved" && "portrait-cell--approved",
    generating && "portrait-cell--generating",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} onClick={onClick} title={asset?.title || entityId}>
      <div className="portrait-cell-image">
        {generating && !src ? (
          <div className="spinner spinner--small" />
        ) : src ? (
          <img src={src} alt={asset?.title || entityId} />
        ) : (
          <div className="portrait-cell-empty">
            <svg width="24" height="36" viewBox="0 0 32 48" fill="none" opacity="0.25">
              <rect x="2" y="2" width="28" height="44" rx="4" stroke="currentColor" strokeWidth="2" />
              <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="2" />
              <path d="M2 38l8-8 6 5 6-7 8 10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
        )}
        {generating && src && (
          <div className="portrait-cell-generating-overlay">
            <div className="spinner spinner--small" />
          </div>
        )}
      </div>
      <div className="portrait-cell-label">{label}</div>
      {status !== "pending" && (
        <div className={`sprite-cell-status sprite-cell-status--${status}`} />
      )}
    </div>
  );
}
