const DB_NAME = "yakov-admin-previews";
const DB_VERSION = 1;
const STORE_NAME = "blobs";

type StoredPreview = {
  id: string;
  blob: Blob;
  createdAt: string;
};

function openPreviewDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;

      if (db.objectStoreNames.contains(STORE_NAME)) {
        resolve(db);
        return;
      }

      const nextVersion = db.version + 1;
      db.close();

      const repairRequest = indexedDB.open(DB_NAME, nextVersion);
      repairRequest.onerror = () => reject(repairRequest.error);
      repairRequest.onsuccess = () => resolve(repairRequest.result);
      repairRequest.onupgradeneeded = () => {
        const repairedDb = repairRequest.result;

        if (!repairedDb.objectStoreNames.contains(STORE_NAME)) {
          repairedDb.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
    };
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const db = await openPreviewDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = callback(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(request ? request.result : undefined);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

export async function savePreviewBlob(id: string, blob: Blob): Promise<void> {
  await withStore("readwrite", (store) =>
    store.put({
      id,
      blob,
      createdAt: new Date().toISOString()
    } satisfies StoredPreview)
  );
}

export async function getPreviewBlob(id: string): Promise<Blob | undefined> {
  const stored = await withStore<StoredPreview>("readonly", (store) => store.get(id));

  return stored?.blob;
}

export async function deletePreviewBlob(id: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id));
}

export async function clearPreviewBlobs(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
}
