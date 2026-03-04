interface TitleBarProps {
  onSettingsClick: () => void;
  onReloadClick?: () => void;
  onOpenClick?: () => void;
  onCloseClick?: () => void;
  projectName?: string | null;
}

export function TitleBar({ onSettingsClick, onReloadClick, onOpenClick, onCloseClick, projectName }: TitleBarProps) {
  return (
    <header className="title-bar">
      <h1 className="title-bar-title">
        AmbonMUD Visualize
        {projectName && (
          <span style={{ fontWeight: 500, opacity: 0.6, fontSize: "0.7em", marginLeft: 12 }}>
            {projectName}
          </span>
        )}
      </h1>
      <div className="title-bar-actions">
        {onOpenClick && (
          <button className="soft-button soft-button--icon" onClick={onOpenClick} title="Open project">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 5.5V14a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 16 14V7.5A1.5 1.5 0 0 0 14.5 6H9L7.5 3.5H3.5A1.5 1.5 0 0 0 2 5.5z" />
            </svg>
          </button>
        )}
        {onCloseClick && (
          <button className="soft-button soft-button--icon" onClick={onCloseClick} title="Close project">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 5l8 8M13 5l-8 8" />
            </svg>
          </button>
        )}
        {onReloadClick && (
          <button className="soft-button soft-button--icon" onClick={onReloadClick} title="Reload project">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 9a6 6 0 0 1 10.2-4.2L15 3v4.5h-4.5l1.8-1.8A4.5 4.5 0 0 0 4.5 9" />
              <path d="M15 9a6 6 0 0 1-10.2 4.2L3 15v-4.5h4.5l-1.8 1.8A4.5 4.5 0 0 0 13.5 9" />
            </svg>
          </button>
        )}
        <button className="soft-button soft-button--icon" onClick={onSettingsClick} title="Settings">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="2.5" />
            <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.1 3.1l1.4 1.4M13.5 13.5l1.4 1.4M3.1 14.9l1.4-1.4M13.5 4.5l1.4-1.4" />
          </svg>
        </button>
      </div>
    </header>
  );
}
