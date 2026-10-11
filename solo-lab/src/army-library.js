export const ARMY_LIMIT = 10;
const ARMY_KEY = "ks-armies-11e";
const META_KEY = "ks-army-library-11e";

export function readArmyLibrary(storage) {
  let armies, meta;
  try {
    armies = JSON.parse(storage.getItem(ARMY_KEY));
  } catch {}
  try {
    meta = JSON.parse(storage.getItem(META_KEY));
  } catch {}
  if (!Array.isArray(armies) || !armies.length || armies.length > ARMY_LIMIT)
    armies = [null];
  const names = armies.map(
    (army, i) => army?.name || meta?.names?.[i] || `New army ${i + 1}`,
  );
  const active =
    Number.isInteger(meta?.active) &&
    meta.active >= 0 &&
    meta.active < armies.length
      ? meta.active
      : 0;
  return { armies, names, active };
}

export function writeArmyLibrary(storage, library) {
  library.names = library.armies.map(
    (army, i) => army?.name || library.names[i],
  );
  storage.setItem(ARMY_KEY, JSON.stringify(library.armies));
  storage.setItem(
    META_KEY,
    JSON.stringify({ names: library.names, active: library.active }),
  );
}

export function addArmySlot(library, copy = false) {
  if (library.armies.length >= ARMY_LIMIT)
    throw Error("Your army library is full (10 armies).");
  const source = library.armies[library.active];
  const army = copy && source ? structuredClone(source) : null;
  if (army) {
    army.id = crypto.randomUUID();
    army.name = (army.name + " copy").slice(0, 100);
  }
  library.armies.push(army);
  library.names.push(army?.name ?? `New army ${library.armies.length}`);
  library.active = library.armies.length - 1;
}

export function renameArmySlot(library, name) {
  name = name.trim().slice(0, 100);
  if (!name) throw Error("Enter an army name.");
  library.names[library.active] = name;
  if (library.armies[library.active])
    library.armies[library.active].name = name;
}

export function removeArmySlot(library) {
  library.armies.splice(library.active, 1);
  library.names.splice(library.active, 1);
  if (!library.armies.length) {
    library.armies.push(null);
    library.names.push("New army 1");
  }
  library.active = Math.min(library.active, library.armies.length - 1);
}
