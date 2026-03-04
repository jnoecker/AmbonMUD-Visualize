interface TitleBarProps {
  onSettingsClick: () => void;
  onReloadClick?: () => void;
  projectName?: string | null;
}

export function TitleBar({ onSettingsClick, onReloadClick, projectName }: TitleBarProps) {
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
