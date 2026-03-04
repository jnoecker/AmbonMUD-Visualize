interface WelcomeScreenProps {
  onNewProject: () => void;
  onOpenProject: () => void;
}

export function WelcomeScreen({ onNewProject, onOpenProject }: WelcomeScreenProps) {
  return (
    <div className="welcome-screen">
      <h1 className="welcome-title">AmbonMUD Visualize</h1>
      <p className="welcome-subtitle">
        Generate style-consistent images for your MUD zones using AI. Load a zone
        YAML file to get started.
      </p>
      <div className="welcome-actions">
        <button className="soft-button soft-button--primary" onClick={onNewProject}>
          New Project
        </button>
        <button className="soft-button" onClick={onOpenProject}>
          Open Project
        </button>
      </div>
    </div>
  );
}
