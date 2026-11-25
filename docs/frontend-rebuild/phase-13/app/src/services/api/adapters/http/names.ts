// Client-side name caches for the compact inline labels screens use
// (projName/whName/itemName in the fixture adapter read its live arrays; HTTP
// has no such store, so resolved names are cached here after a loader runs).
//
// Honest boundaries:
// · The projects cache is populated by the projects loader (mrApi.projects).
// · Warehouses/items are NOT loaded by any wired domain in this slice, so
//   whName/itemName fall back to the raw id — a visible, honest placeholder,
//   never an invented name.
// · An unknown project id also falls back to the raw id.
const projects = new Map<string, string>();
const warehouses = new Map<string, string>();
const items = new Map<string, string>();

export const names = {
  seedProjects(list: readonly { id: string; name: string }[]) {
    for (const p of list) if (p.name) projects.set(p.id, p.name);
  },
  seedWarehouses(list: readonly { id: string; name: string }[]) {
    for (const w of list) if (w.name) warehouses.set(w.id, w.name);
  },
  seedItems(list: readonly { id: string; name: string }[]) {
    for (const i of list) if (i.name) items.set(i.id, i.name);
  },
};

/** Project display name from the seeded cache; raw id when unknown. */
export const projName = (id?: string) => (id ? (projects.get(id) ?? id) : '—');
/** Warehouse display name from the seeded cache; raw id when unknown. */
export const whName = (id: string) => warehouses.get(id) ?? id;
/** Item display name from the seeded cache; raw id when unknown. */
export const itemName = (id: string) => items.get(id) ?? id;
