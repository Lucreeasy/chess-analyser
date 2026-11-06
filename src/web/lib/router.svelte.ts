/**
 * A small hash router: works under any URL path prefix without
 * knowing the prefix (docs/DECISIONS.md D-001), since the hash is
 * never sent to the server.
 */

function currentRoute(): string {
  const hash = window.location.hash.slice(1); // drop the leading "#"
  return hash === "" ? "/" : hash;
}

export const route = $state({ path: currentRoute() });

window.addEventListener("hashchange", () => {
  route.path = currentRoute();
});

/**
 * `replace: true` updates the address without adding a history entry
 * (docs/06-GAMES-SPEC.md section B1: the Review screen's ply number
 * "replacing, not adding, history entries").
 */
export function navigate(path: string, options: { replace?: boolean } = {}): void {
  if (options.replace) {
    history.replaceState(null, "", `#${path}`);
    route.path = currentRoute();
  } else {
    window.location.hash = path;
  }
}
