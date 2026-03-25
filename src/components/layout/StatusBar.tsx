import { useEffect, useRef, useState } from "react";
import { useProject } from "../../context/ProjectContext";
import { onClickKeyDown } from "../../hooks/a11y";

interface StatusBarProps {
  onBatchClick: () => void;
  onExportClick: () => void;
  onCustomAssetClick: () => void;
  onBatchRemoveBgClick: () => void;
  onRecompressClick: () => void;
}

export function StatusBar({ onBatchClick, onExportClick, onCustomAssetClick, onBatchRemoveBgClick, onRecompressClick }: StatusBarProps) {
  const { project, getApprovalCounts, batchApprove } = useProject();
  const [approveMsg, setApproveMsg] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close "More" menu on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [moreOpen]);

  // Close on Escape
  useEffect(() => {
    if (!moreOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [moreOpen]);

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

  // Count entities eligible for batch approve (unapproved with exactly 1 variant)
  const batchApproveCount = Object.values(project.zones).reduce((n, zone) =>
    n + Object.values(zone.assets).filter(
      (a) => a.status !== "approved" && a.variants.length === 1
    ).length, 0
  );

  const handleBatchApprove = async () => {
    setMoreOpen(false);
    if (batchApproveCount === 0) {
      setApproveMsg("All entities already approved or need images first");
      setTimeout(() => setApproveMsg(null), 3000);
      return;
    }
    const ok = window.confirm(
      `Approve ${batchApproveCount} entit${batchApproveCount === 1 ? "y" : "ies"} with a single generated image?`
    );
    if (!ok) return;
    const count = await batchApprove();
    setApproveMsg(`Approved ${count} entit${count === 1 ? "y" : "ies"}`);
    setTimeout(() => setApproveMsg(null), 3000);
  };

  return (
    <footer className="status-bar">
      <div className="status-bar-left">
        <span>
          {zoneCount} zone{zoneCount !== 1 ? "s" : ""} &middot; {approved}/{total} approved
        </span>
        {total > 0 && (
          <div className="status-bar-progress">
            <div
              className="progress-bar-fill"
              style={{ width: `${(approved / total) * 100}%` }}
            />
          </div>
        )}
        <span aria-live="polite" className="status-bar-message">
          {approveMsg ?? ""}
        </span>
      </div>
      <div className="status-bar-right">
        {/* More menu — rare operations */}
        <div className="status-bar-more" ref={moreRef}>
          <button
            className="soft-button soft-button--small"
            onClick={() => setMoreOpen(!moreOpen)}
            aria-expanded={moreOpen}
            aria-haspopup="true"
          >
            More
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d={moreOpen ? "M2 6.5L5 3.5L8 6.5" : "M2 3.5L5 6.5L8 3.5"} />
            </svg>
          </button>
          {moreOpen && (
            <div className="status-bar-menu" role="menu">
              <button
                className="status-bar-menu-item"
                role="menuitem"
                onClick={() => { setMoreOpen(false); onCustomAssetClick(); }}
                onKeyDown={onClickKeyDown(() => { setMoreOpen(false); onCustomAssetClick(); })}
              >
                + Custom Asset
              </button>
              <button
                className="status-bar-menu-item"
                role="menuitem"
                onClick={handleBatchApprove}
                onKeyDown={onClickKeyDown(handleBatchApprove)}
              >
                Batch Approve
              </button>
              <button
                className="status-bar-menu-item"
                role="menuitem"
                onClick={() => { setMoreOpen(false); onBatchRemoveBgClick(); }}
                onKeyDown={onClickKeyDown(() => { setMoreOpen(false); onBatchRemoveBgClick(); })}
              >
                Remove Backgrounds
              </button>
              <button
                className="status-bar-menu-item"
                role="menuitem"
                onClick={() => { setMoreOpen(false); onRecompressClick(); }}
                onKeyDown={onClickKeyDown(() => { setMoreOpen(false); onRecompressClick(); })}
              >
                Optimize File Sizes
              </button>
            </div>
          )}
        </div>

        {/* Primary actions — always visible */}
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
