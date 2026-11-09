export type StaffAlertDevice = { id: string; token: string; userId: string };
export async function storeStaffAlertDevice(value: StaffAlertDevice | null) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("lc-staff-alerts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("device");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("device", "readwrite");
    const store = transaction.objectStore("device");
    if (value) store.put(value, "registration"); else store.delete("registration");
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}