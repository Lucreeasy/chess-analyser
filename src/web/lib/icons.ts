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
  check: `<polyline points="4,13 9,18 20,6"/>`,
  alert: `<path d="M12 3 L22 20 L2 20 Z"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>`,
  close: `<line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>`,
  filter: `<line x1="4" y1="7" x2="20" y2="7"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="17" x2="14" y2="17"/>`,
  sortAsc: `<polyline points="6,15 12,9 18,15"/>`,
  sortDesc: `<polyline points="6,9 12,15 18,9"/>`,
  file: `<path d="M7 3h7l4 4v14H7z"/><polyline points="14,3 14,7 18,7"/>`,
  clipboard: `<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9z"/>`,
  user: `<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>`,
  pause: `<line x1="8" y1="5" x2="8" y2="19" stroke-width="4"/><line x1="16" y1="5" x2="16" y2="19" stroke-width="4"/>`,
  play: `<path d="M7 4 L20 12 L7 20 Z" fill="currentColor" stroke="none"/>`,
  chevron: `<polyline points="6,9 12,15 18,9"/>`,
  flip: `<line x1="9" y1="19" x2="9" y2="5"/><polyline points="5,9 9,5 13,9"/>
    <line x1="15" y1="5" x2="15" y2="19"/><polyline points="11,15 15,19 19,15"/>`,
};
