import { STORE_NAMES, keyOf, tx } from "./db";
import type { BackupFile, StoreName, StoreValueMap } from "./types";

type Rows = { [K in StoreName]: StoreValueMap[K][] };

/** Read every store in one transaction so the backup is a consistent snapshot. */
export async function exportAll(): Promise<BackupFile> {
  const requests = {} as { [K in StoreName]: IDBRequest<StoreValueMap[K][]> };
  await tx([...STORE_NAMES], "readonly", (t) => {
    for (const store of STORE_NAMES) {
      (requests as Record<string, IDBRequest>)[store] = t.objectStore(store).getAll();
    }
  });
  const stores = {} as Rows;
  for (const store of STORE_NAMES) (stores as Record<string, unknown>)[store] = requests[store].result;
  return { app: "pocket-deck", version: 1, exportedAt: new Date().toISOString(), stores };
}

function isBackupFile(obj: unknown): obj is BackupFile {
  if (!obj || typeof obj !== "object") return false;
  const b = obj as Record<string, unknown>;
  if (b.app !== "pocket-deck" || b.version !== 1 || typeof b.exportedAt !== "string") return false;
  if (!b.stores || typeof b.stores !== "object") return false;
  const stores = b.stores as Record<string, unknown>;
  return STORE_NAMES.every((s) => Array.isArray(stores[s]));
}

/**
 * Replace everything with the backup's contents. One transaction: if any row is
 * rejected the whole import aborts and the existing data is untouched.
 */
export async function importAll(file: unknown): Promise<void> {
  if (!isBackupFile(file)) {
    throw new Error("That doesn't look like a Pocket Deck backup, or it's from a newer version of the app.");
  }
  // Work out every key up front so a bad row fails before the transaction opens.
  const plan = STORE_NAMES.map((store) => ({
    store,
    rows: (file.stores[store] as StoreValueMap[StoreName][]).map((row) => ({
      row,
      key: keyOf(store, row as never) as string,
    })),
  }));
  await tx([...STORE_NAMES], "readwrite", (t) => {
    for (const { store, rows } of plan) {
      const os = t.objectStore(store);
      os.clear();
      for (const { row, key } of rows) os.put(row, key);
    }
  });
}

export function backupFilename(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `pocket-deck-backup-${y}-${m}-${d}.json`;
}
