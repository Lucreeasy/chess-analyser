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

export function navigate(path: string): void {
  window.location.hash = path;
}
