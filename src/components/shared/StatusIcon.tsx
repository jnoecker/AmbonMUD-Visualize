import type { EntityStatus } from "../../types/project";

interface StatusIconProps {
  status: EntityStatus;
}

export function StatusIcon({ status }: StatusIconProps) {
  switch (status) {
    case "pending":
      return (
        <span className="status-icon status-icon--pending" title="Pending">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </span>
      );
    case "generated":
      return (
        <span className="status-icon status-icon--generated" title="Generated">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <circle cx="7" cy="7" r="5.5" />
          </svg>
        </span>
      );
    case "approved":
      return (
        <span className="status-icon status-icon--approved" title="Approved">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" fill="currentColor" />
            <path
              d="M4.5 7L6.5 9L9.5 5"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      );
  }
}
