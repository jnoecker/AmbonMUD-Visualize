import { StatusIcon } from "../shared/StatusIcon";
import type { EntityStatus } from "../../types/project";

interface EntityTreeItemProps {
  title: string;
  status: EntityStatus;
  selected: boolean;
  onClick: () => void;
}

export function EntityTreeItem({ title, status, selected, onClick }: EntityTreeItemProps) {
  return (
    <li
      className={`entity-tree-item${selected ? " entity-tree-item--selected" : ""}`}
      onClick={onClick}
    >
      <StatusIcon status={status} />
      <span className="entity-tree-item-title">{title}</span>
    </li>
  );
}
