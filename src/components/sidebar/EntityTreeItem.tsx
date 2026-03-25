import { StatusIcon } from "../shared/StatusIcon";
import { onClickKeyDown } from "../../hooks/a11y";
import type { EntityStatus } from "../../types/project";

interface EntityTreeItemProps {
  title: string;
  status: EntityStatus;
  selected: boolean;
  generating: boolean;
  onClick: () => void;
}

export function EntityTreeItem({ title, status, selected, generating, onClick }: EntityTreeItemProps) {
  return (
    <li
      className={`entity-tree-item${selected ? " entity-tree-item--selected" : ""}`}
      role="treeitem"
      tabIndex={0}
      aria-selected={selected}
      onClick={onClick}
      onKeyDown={onClickKeyDown(onClick)}
    >
      {generating ? (
        <span className="spinner spinner--small" />
      ) : (
        <StatusIcon status={status} />
      )}
      <span className="entity-tree-item-title">{title}</span>
    </li>
  );
}
