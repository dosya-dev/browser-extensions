const NAME = "savetodosya"; const VERSION = 1;
let dbPromise: Promise<IDBDatabase> | null = null;
export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const items = db.createObjectStore("items", { keyPath: "id" });
      items.createIndex("by_state", "state"); items.createIndex("by_createdAt", "createdAt");
      db.createObjectStore("blobs", { keyPath: "id" });
      db.createObjectStore("auth", { keyPath: "key" });
      db.createObjectStore("prefs", { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
/** Test hook: forget the cached connection (vitest replaces indexedDB per test). */
export function resetDbForTests(): void { dbPromise = null; }
export function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
export async function withStore<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  const t = db.transaction(store, mode);
  const result = await fn(t.objectStore(store));
  await new Promise<void>((resolve, reject) => { t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error); });
  return result;
}
