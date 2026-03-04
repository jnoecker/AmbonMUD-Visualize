import { useCallback, useEffect, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import "./App.css";

import { SettingsProvider, useSettings } from "./context/SettingsContext";
import { ProjectProvider, useProject } from "./context/ProjectContext";
import { AppShell } from "./components/layout/AppShell";
import { TitleBar } from "./components/layout/TitleBar";
import { StatusBar } from "./components/layout/StatusBar";
import { Sidebar } from "./components/sidebar/Sidebar";
import { DetailPanel } from "./components/detail/DetailPanel";
import { WelcomeScreen } from "./components/dialogs/WelcomeScreen";
import { SettingsDialog } from "./components/dialogs/SettingsDialog";
import { NewProjectDialog } from "./components/dialogs/NewProjectDialog";
import { BatchDialog } from "./components/dialogs/BatchDialog";
import { ExportDialog } from "./components/dialogs/ExportDialog";

function AppInner() {
  const { project, projectDir, openExistingProject, reloadProject } = useProject();
  const { settings, updateSettings } = useSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Reopen last project on launch
  useEffect(() => {
    if (!project && settings.lastProjectPath) {
      openExistingProject(settings.lastProjectPath).catch(() => {
        // Last project might not exist anymore
      });
    }
  }, [settings.lastProjectPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save last project path
  useEffect(() => {
    if (projectDir && projectDir !== settings.lastProjectPath) {
      updateSettings({ lastProjectPath: projectDir });
    }
  }, [projectDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOpenProject = useCallback(async () => {
    const result = await openDialog({
      directory: true,
      title: "Open Project Directory",
    });
    if (result) {
      await openExistingProject(result);
    }
  }, [openExistingProject]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+, for settings
      if (e.ctrlKey && e.key === ",") {
        e.preventDefault();
        setShowSettings(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <AppShell
        titleBar={
          <TitleBar
            onSettingsClick={() => setShowSettings(true)}
            onReloadClick={project ? reloadProject : undefined}
            projectName={project?.name}
          />
        }
        sidebar={project ? <Sidebar /> : null}
        detail={
          project ? (
            <DetailPanel />
          ) : (
            <WelcomeScreen
              onNewProject={() => setShowNewProject(true)}
              onOpenProject={handleOpenProject}
            />
          )
        }
        statusBar={
          <StatusBar
            onBatchClick={() => setShowBatch(true)}
            onExportClick={() => setShowExport(true)}
          />
        }
      />

      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
      {showNewProject && <NewProjectDialog onClose={() => setShowNewProject(false)} />}
      {showBatch && <BatchDialog onClose={() => setShowBatch(false)} />}
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <ProjectProvider>
        <AppInner />
      </ProjectProvider>
    </SettingsProvider>
  );
}
