import { AssetCell } from "../shared/AssetCell";
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

const EMPTY_ICON = (
  <svg width="20" height="20" viewBox="0 0 48 48" fill="none" opacity="0.25">
    <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2" />
    <path d="M24 14v20M14 24h20" stroke="currentColor" strokeWidth="2" />
  </svg>
);

export function AbilityCell({ entityId, asset, label, level, selected, generating, onClick, getDataUrl }: AbilityCellProps) {
  return (
    <AssetCell
      cssPrefix="ability-cell"
      entityId={entityId}
      asset={asset}
      label={label}
      emptyIcon={EMPTY_ICON}
      selected={selected}
      generating={generating}
      onClick={onClick}
      getDataUrl={getDataUrl}
      extraLabel={
        <div className="ability-cell-info">
          <div className="ability-cell-name">{label}</div>
          {level > 0 && <div className="ability-cell-level">Lv {level}</div>}
        </div>
      }
    />
  );
}
