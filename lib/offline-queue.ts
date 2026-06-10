// Client-side only — IndexedDB queue for offline activations and purchases

export interface QueuedActivation {
  type: "activation";
  portal: "owner" | "dealer";
  role: "owner" | "admin" | "exec";
  tenantId: string;
  dealerId: string;
  modelId: string;
  modelName: string;
  quantity: number;
  activationDate: string;
  imei?: string;
  isCrossRegion: boolean;
  stockSnapshot: number;
  dealerPrice: number;
}

export interface QueuedPurchase {
  type: "purchase";
  portal: "owner" | "dealer";
  role: "owner" | "admin" | "exec";
  tenantId: string;
  dealerId: string;
  modelId: string;
  modelName: string;
  quantity: number;
  purchaseDate: string;
  unitDealerPrice: number;
  unitInvoicePrice: number;
  source: string;
  referenceNote?: string;
}

export type QueuedItem = { id: string; queuedAt: string } & (QueuedActivation | QueuedPurchase);

const DB_NAME = "alhamd-offline";
const STORE = "queue";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addToQueue(item: QueuedActivation | QueuedPurchase): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const full = { ...item, id, queuedAt: new Date().toISOString() } as QueuedItem;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(full);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueue(): Promise<QueuedItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as QueuedItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeFromQueue(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueueCount(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
