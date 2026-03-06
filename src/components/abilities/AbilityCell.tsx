import { useEffect, useState } from "react";
import type { AssetEntry } from "../../types/project";

interface AbilityCellProps {
  entityId: string;
  asset: AssetEntry | undefined;
  label: string;
  level: number;
  selected: boolean;
  generating: boolean;
  onClick: () => void;
  getDataUrl: (entityId: string, filename: string) => Promise<string>;
}

export function AbilityCell({
  entityId,
  asset,
  label,
  level,
  selected,
  generating,
  onClick,
  getDataUrl,
}: AbilityCellProps) {
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
    "ability-cell",
    selected && "ability-cell--selected",
    status === "approved" && "ability-cell--approved",
    generating && "ability-cell--generating",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} onClick={onClick} title={asset?.title || entityId}>
      <div className="ability-cell-image">
        {generating && !src ? (
          <div className="spinner spinner--small" />
        ) : src ? (
          <img src={src} alt={label} />
        ) : (
          <div className="ability-cell-empty">
            <svg width="20" height="20" viewBox="0 0 48 48" fill="none" opacity="0.25">
              <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2" />
              <path d="M24 14v20M14 24h20" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
        )}
        {generating && src && (
          <div className="ability-cell-generating-overlay">
            <div className="spinner spinner--small" />
          </div>
        )}
      </div>
      <div className="ability-cell-info">
        <div className="ability-cell-name">{label}</div>
        {level > 0 && <div className="ability-cell-level">Lv {level}</div>}
      </div>
      {status !== "pending" && (
        <div className={`ability-cell-status ability-cell-status--${status}`} />
      )}
    </div>
  );
}
