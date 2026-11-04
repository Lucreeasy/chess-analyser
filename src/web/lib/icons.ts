/**
 * Line icons, 24x24 grid, 2px stroke (docs/07-UI-SPEC.md section 4).
 * Each value is the inner SVG markup for a <svg viewBox="0 0 24 24">.
 */
export const icons: Record<string, string> = {
  games: `<circle cx="4" cy="6" r="1.4" fill="currentColor" stroke="none"/><line x1="8" y1="6" x2="21" y2="6"/>
    <circle cx="4" cy="12" r="1.4" fill="currentColor" stroke="none"/><line x1="8" y1="12" x2="21" y2="12"/>
    <circle cx="4" cy="18" r="1.4" fill="currentColor" stroke="none"/><line x1="8" y1="18" x2="21" y2="18"/>`,
  insights: `<line x1="5" y1="20" x2="5" y2="11"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="19" y1="20" x2="19" y2="14"/>`,
  puzzles: `<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>
    <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>`,
  settings: `<line x1="3" y1="7" x2="21" y2="7"/><circle cx="9" cy="7" r="2.2" fill="var(--surface)"/>
    <line x1="3" y1="17" x2="21" y2="17"/><circle cx="15" cy="17" r="2.2" fill="var(--surface)"/>`,
  import: `<line x1="12" y1="3" x2="12" y2="15"/><polyline points="7,10 12,15 17,10"/><line x1="4" y1="20" x2="20" y2="20"/>`,
  sync: `<path d="M20 11a8 8 0 0 0-14.9-3.4"/><polyline points="5,3 5,8 10,8"/>
    <path d="M4 13a8 8 0 0 0 14.9 3.4"/><polyline points="19,21 19,16 14,16"/>`,
};
