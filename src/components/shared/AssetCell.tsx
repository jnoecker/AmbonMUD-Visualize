import { memo, useEffect, useState, type ReactNode } from "react";
import { onClickKeyDown } from "../../hooks/a11y";
import type { AssetEntry } from "../../types/project";

interface AssetCellProps {
  /** CSS class prefix: "sprite-cell", "ability-cell", or "portrait-cell" */
  cssPrefix: string;
  entityId: string;
  asset: AssetEntry | undefined;
  label: string;
  extraLabel?: ReactNode;
  emptyIcon: ReactNode;
  selected: boolean;
  generating: boolean;
  onClick: () => void;
  getDataUrl: (entityId: string, filename: string) => Promise<string>;
}

export const AssetCell = memo(function AssetCell({
  cssPrefix,
  entityId,
  asset,
  label,
  extraLabel,
  emptyIcon,
  selected,
  generating,
  onClick,
  getDataUrl,
}: AssetCellProps) {
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
    cssPrefix,
    selected && `${cssPrefix}--selected`,
    status === "approved" && `${cssPrefix}--approved`,
    generating && `${cssPrefix}--generating`,
  ]
    .filter(Boolean)
    .join(" ");

  const accessibleLabel = asset?.title || label || entityId;

  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      aria-label={accessibleLabel}
      onClick={onClick}
      onKeyDown={onClickKeyDown(onClick)}
      title={accessibleLabel}
    >
      <div className={`${cssPrefix}-image`}>
        {generating && !src ? (
          <div className="spinner spinner--small" />
        ) : src ? (
          <img src={src} alt={accessibleLabel} />
        ) : (
          <div className={`${cssPrefix}-empty`}>{emptyIcon}</div>
        )}
        {generating && src && (
          <div className={`${cssPrefix}-generating-overlay`}>
            <div className="spinner spinner--small" />
          </div>
        )}
      </div>
      {extraLabel ? (
        extraLabel
      ) : (
        <div className={`${cssPrefix}-label`}>{label}</div>
      )}
      {status !== "pending" && (
        <div className={`${cssPrefix}-status ${cssPrefix}-status--${status}`} />
      )}
    </div>
  );
});
