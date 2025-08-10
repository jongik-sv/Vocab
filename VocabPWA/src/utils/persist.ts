// src/utils/persist.ts
export async function ensurePersistence() {
  if (!('storage' in navigator) || !('persist' in navigator.storage)) return false
  try {
    const persisted = await navigator.storage.persisted()
    return persisted || await navigator.storage.persist()
  } catch {
    return false
  }
}