import { useState } from "react";
import { useProject } from "../../context/ProjectContext";

interface StatusBarProps {
  onBatchClick: () => void;
  onExportClick: () => void;
}

export function StatusBar({ onBatchClick, onExportClick }: StatusBarProps) {
  const { project, getApprovalCounts, batchApprove } = useProject();
  const [approveMsg, setApproveMsg] = useState<string | null>(null);

  if (!project) {
    return (
      <footer className="status-bar">
        <div className="status-bar-left">No project open</div>
        <div className="status-bar-right" />
      </footer>
    );
  }

  const { approved, total } = getApprovalCounts();
  const zoneCount = Object.keys(project.zones).length;
  const hasDefaultImages = Object.values(project.zones).some(
    (z) => z.defaultImages && Object.values(z.defaultImages).some((d) => d?.filename)
  );

  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        <span>
          {zoneCount} zone{zoneCount !== 1 ? "s" : ""} &middot; {approved}/{total} approved
        </span>
        {total > 0 && (
          <div className="progress-bar" style={{ width: 120 }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${(approved / total) * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="status-bar-right">
        {approveMsg && (
          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
            {approveMsg}
          </span>
        )}
        <button
          className="soft-button soft-button--small"
          onClick={async () => {
            const count = await batchApprove();
            setApproveMsg(
              count > 0
                ? `Approved ${count} entit${count === 1 ? "y" : "ies"}`
                : "Nothing to auto-approve"
            );
            setTimeout(() => setApproveMsg(null), 3000);
          }}
        >
          Batch Approve
        </button>
        <button className="soft-button soft-button--small" onClick={onBatchClick}>
          Batch Generate
        </button>
        <button
          className="soft-button soft-button--small soft-button--success"
          onClick={onExportClick}
          disabled={approved === 0 && !hasDefaultImages}
        >
          Export
        </button>
      </div>
    </footer>
  );
}
