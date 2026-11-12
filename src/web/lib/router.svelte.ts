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

/** The current route's query string ("mode=all&tag=hung_piece"), "" when it has none. */
export function routeQuery(): string {
  const i = route.path.indexOf("?");
  return i < 0 ? "" : route.path.slice(i + 1);
}

window.addEventListener("hashchange", () => {
  route.path = currentRoute();
});

/**
 * `replace: true` updates the address without adding a history entry, as the Review screen does for its ply
 * number ("replacing, not adding, history entries").
 */
export function navigate(path: string, options: { replace?: boolean } = {}): void {
  if (options.replace) {
    history.replaceState(null, "", `#${path}`);
    route.path = currentRoute();
  } else {
    window.location.hash = path;
  }
}
