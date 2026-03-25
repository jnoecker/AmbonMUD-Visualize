import { useMemo, type ReactNode } from "react";

interface AppShellProps {
  titleBar: ReactNode;
  sidebar: ReactNode;
  detail: ReactNode;
  statusBar: ReactNode;
  sidebarCollapsed?: boolean;
}

/** Generate deterministic mote configs from a seed. */
function generateMotes(count: number) {
  const motes: Array<{
    size: number;
    x: number;
    y: number;
    hue: number;
    opacity: number;
    duration: number;
    delay: number;
    dx1: number; dy1: number;
    dx2: number; dy2: number;
    dx3: number; dy3: number;
  }> = [];

  // Use golden ratio for distribution
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const golden = (i * 0.618033988749895) % 1;
    motes.push({
      size: 2 + (golden * 4),        // 2-6px
      x: (t * 120) - 10,             // -10% to 110% spread
      y: (golden * 120) - 10,        // -10% to 110% spread
      hue: 240 + (golden * 40) - 20, // 220-280 (lavender to blue range)
      opacity: 0.15 + golden * 0.25, // 0.15-0.40
      duration: 12 + (t * 16),       // 12-28s (slow)
      delay: -(t * 20),              // staggered starts
      dx1: (golden - 0.5) * 24,
      dy1: (t - 0.5) * -30,
      dx2: (t - 0.5) * -16,
      dy2: (golden - 0.5) * -40,
      dx3: (golden - 0.3) * 20,
      dy3: (t - 0.7) * -18,
    });
  }
  return motes;
}

const MOTE_COUNT = 18;

export function AppShell({ titleBar, sidebar, detail, statusBar, sidebarCollapsed }: AppShellProps) {
  const cls = `app-shell${sidebarCollapsed ? " app-shell--sidebar-collapsed" : ""}`;

  const motes = useMemo(() => generateMotes(MOTE_COUNT), []);

  return (
    <div className={cls}>
      {/* Ambient motes of light */}
      <div className="ambient-motes" aria-hidden="true">
        {motes.map((m, i) => (
          <div
            key={i}
            className="ambient-mote"
            style={{
              width: m.size,
              height: m.size,
              left: `${m.x}%`,
              top: `${m.y}%`,
              "--mote-opacity": m.opacity,
              "--mote-dx1": `${m.dx1}px`,
              "--mote-dy1": `${m.dy1}px`,
              "--mote-dx2": `${m.dx2}px`,
              "--mote-dy2": `${m.dy2}px`,
              "--mote-dx3": `${m.dx3}px`,
              "--mote-dy3": `${m.dy3}px`,
              background: `hsl(${m.hue} 50% 78%)`,
              animationDuration: `${m.duration}s`,
              animationDelay: `${m.delay}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>
      {/* Keep the two large ambient orbs for background wash */}
      <div className="ambient-orb ambient-orb-a" aria-hidden="true" />
      <div className="ambient-orb ambient-orb-b" aria-hidden="true" />
      {titleBar}
      <aside className="sidebar">{sidebar}</aside>
      <main className="detail-area">{detail}</main>
      {statusBar}
    </div>
  );
}
