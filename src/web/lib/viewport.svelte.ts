/** Whether the viewport is at least the project's desktop breakpoint (768px, used throughout the CSS). */

const query = window.matchMedia("(min-width: 768px)");

export const viewport: { isDesktop: boolean } = $state({ isDesktop: query.matches });

query.addEventListener("change", (e) => {
  viewport.isDesktop = e.matches;
});
