import type { ReactNode } from "react";

interface AppShellProps {
  titleBar: ReactNode;
  sidebar: ReactNode;
  detail: ReactNode;
  statusBar: ReactNode;
}

export function AppShell({ titleBar, sidebar, detail, statusBar }: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="ambient-orb ambient-orb-a" />
      <div className="ambient-orb ambient-orb-b" />
      {titleBar}
      <aside className="sidebar">{sidebar}</aside>
      <main className="detail-area">{detail}</main>
      {statusBar}
    </div>
  );
}
