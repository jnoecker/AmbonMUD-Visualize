import { AssetCell } from "../shared/AssetCell";
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

const EMPTY_ICON = (
  <svg width="24" height="36" viewBox="0 0 32 48" fill="none" opacity="0.25">
    <rect x="2" y="2" width="28" height="44" rx="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="16" cy="16" r="5" stroke="currentColor" strokeWidth="2" />
    <path d="M2 38l8-8 6 5 6-7 8 10" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

export function PortraitCell({ entityId, asset, label, selected, generating, onClick, getDataUrl }: PortraitCellProps) {
  return (
    <AssetCell
      cssPrefix="portrait-cell"
      entityId={entityId}
      asset={asset}
      label={label}
      emptyIcon={EMPTY_ICON}
      selected={selected}
      generating={generating}
      onClick={onClick}
      getDataUrl={getDataUrl}
    />
  );
}
