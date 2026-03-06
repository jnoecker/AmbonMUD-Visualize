interface WelcomeScreenProps {
  onNewProject: () => void;
  onNewBlankProject: () => void;
  onOpenProject: () => void;
}

export function WelcomeScreen({ onNewProject, onNewBlankProject, onOpenProject }: WelcomeScreenProps) {
  return (
    <div className="welcome-screen">
      <h1 className="welcome-title">AmbonMUD Visualize</h1>
      <p className="welcome-subtitle">
        Generate style-consistent images for your MUD zones using AI.
      </p>
      <div className="welcome-actions">
        <button className="soft-button soft-button--primary" onClick={onNewProject}>
          New Zone Project
        </button>
        <button className="soft-button soft-button--primary" onClick={onNewBlankProject}>
          New Blank Project
        </button>
        <button className="soft-button" onClick={onOpenProject}>
          Open Project
        </button>
      </div>
      <p className="welcome-hint">
        <strong>Zone Project</strong> — import zone YAML files to generate room, mob, and item art.
        <br />
        <strong>Blank Project</strong> — create standalone assets like menu bars, icons, and UI elements.
      </p>
    </div>
  );
}
