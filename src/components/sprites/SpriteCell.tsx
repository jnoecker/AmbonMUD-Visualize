import { AssetCell } from "../shared/AssetCell";
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

const EMPTY_ICON = (
  <svg width="24" height="24" viewBox="0 0 48 48" fill="none" opacity="0.25">
    <rect x="6" y="10" width="36" height="28" rx="4" stroke="currentColor" strokeWidth="2" />
    <circle cx="17" cy="21" r="3" stroke="currentColor" strokeWidth="2" />
    <path d="M6 32l10-8 6 5 8-10 12 13" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
  </svg>
);

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function SpriteCell({ entityId, asset, race, selected, generating, onClick, getDataUrl }: SpriteCellProps) {
  return (
    <AssetCell
      cssPrefix="sprite-cell"
      entityId={entityId}
      asset={asset}
      label={capitalize(race)}
      emptyIcon={EMPTY_ICON}
      selected={selected}
      generating={generating}
      onClick={onClick}
      getDataUrl={getDataUrl}
    />
  );
}
