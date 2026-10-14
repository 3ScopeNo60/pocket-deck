import type {
  StoreName,
  StoreKeyMap,
  StoreValueMap,
} from "./types";

const DB_NAME = "pocket-deck";
const DB_VERSION = 1;

const STORES: StoreName[] = [
  "profile",
  "foods",
  "products",
  "meals",
  "mealVersions",
  "prefs",
  "days",
  "week",
  "stock",
  "shopping",
  "meds",
  "labs",
  "notes",
  "customSuppers",
];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Which field of a row is its key. Singletons live under the key "me". */
const KEY_FIELD: Record<StoreName, string | null> = {
  profile: null,
  prefs: null,
  foods: "id",
  products: "id",
  meals: "id",
  mealVersions: "id",
  days: "date",
  week: "weekOf",
  stock: "itemId",
  shopping: "id",
  meds: "id",
  labs: "date",
  notes: "id",
  customSuppers: "id",
};

export function keyOf<T extends StoreName>(store: T, value: StoreValueMap[T]): StoreKeyMap[T] {
  const field = KEY_FIELD[store];
  if (field === null) return "me" as StoreKeyMap[T];
  const key = (value as unknown as Record<string, unknown>)[field];
  if (typeof key !== "string" || !key) throw new Error(`${store}: row has no "${field}" to use as its key`);
  return key as StoreKeyMap[T];
}

export async function get<T extends StoreName>(
  store: T,
  key: StoreKeyMap[T]
): Promise<StoreValueMap[T] | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll<T extends StoreName>(store: T): Promise<StoreValueMap[T][]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put<T extends StoreName>(store: T, value: StoreValueMap[T]): Promise<void> {
  const db = await openDB();
  const key = keyOf(store, value);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function del<T extends StoreName>(store: T, key: StoreKeyMap[T]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clear<T extends StoreName>(store: T): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Run `fn` against one atomic transaction. `fn` must queue its requests synchronously
 * (no awaiting inside): IndexedDB commits a transaction as soon as it has no pending
 * requests, so an await between requests can leave it closed. Resolves on commit.
 */
export async function tx<T>(
  stores: StoreName[],
  mode: "readonly" | "readwrite",
  fn: (tx: IDBTransaction) => T
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const txn = db.transaction(stores, mode);
    let result: T;
    try {
      result = fn(txn);
    } catch (err) {
      txn.abort();
      reject(err);
      return;
    }
    txn.oncomplete = () => resolve(result);
    txn.onerror = () => reject(txn.error);
    txn.onabort = () => reject(txn.error ?? new Error("Transaction aborted"));
  });
}

/** Close the connection and forget it (used by tests, and before a destructive reset). */
export async function closeDb(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}

export const STORE_NAMES: readonly StoreName[] = STORES;
