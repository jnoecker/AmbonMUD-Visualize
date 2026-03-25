import { onClickKeyDown } from "../../hooks/a11y";
import type { EntityType } from "../../types/entities";
import type { ZoneData } from "../../types/project";

interface EntitySummaryProps {
  label: string;
  entityType: EntityType;
  zone: ZoneData;
  selected: boolean;
  onSelect: () => void;
  templateReady?: boolean;
}

export function EntitySummary({
  label,
  entityType,
  zone,
  selected,
  onSelect,
  templateReady,
}: EntitySummaryProps) {
  const assets = Object.values(zone.assets);
  const filtered = assets.filter((a) => a.entityType === entityType);
  const approved = filtered.filter((a) => a.status === "approved").length;
  const generated = filtered.filter(
    (a) => a.status === "generated" || a.status === "approved"
  ).length;
  const total = filtered.length;

  return (
    <div
      className={`sprite-summary${selected ? " sprite-summary--selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={onClickKeyDown(onSelect)}
    >
      <div className="sprite-summary-label">
        {label}
        <span className="sprite-summary-count">{total}</span>
      </div>
      <div className="sprite-summary-stats">
        {approved > 0 && (
          <span className="sprite-summary-stat sprite-summary-stat--approved">
            {approved} approved
          </span>
        )}
        {generated > approved && (
          <span className="sprite-summary-stat sprite-summary-stat--generated">
            {generated - approved} generated
          </span>
        )}
        {total - generated > 0 && (
          <span className="sprite-summary-stat sprite-summary-stat--pending">
            {total - generated} pending
          </span>
        )}
      </div>
      {templateReady && (
        <div className="sprite-summary-template">Template ready</div>
      )}
    </div>
  );
}
