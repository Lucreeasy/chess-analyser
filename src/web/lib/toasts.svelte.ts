/** A stack of at most 4, success/info auto-dismiss after 5s, errors stay. */

export interface Toast {
  id: number;
  message: string;
  kind: "success" | "error";
}

export const toasts: Toast[] = $state([]);

let nextId = 1;

export function showToast(message: string, kind: Toast["kind"] = "success"): void {
  const id = nextId++;
  toasts.push({ id, message, kind });
  if (toasts.length > 4) toasts.shift();
  if (kind === "success") setTimeout(() => dismissToast(id), 5000);
}

export function dismissToast(id: number): void {
  const index = toasts.findIndex((t) => t.id === id);
  if (index !== -1) toasts.splice(index, 1);
}
