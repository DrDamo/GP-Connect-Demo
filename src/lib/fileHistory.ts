// Recently opened / pasted GP Connect bundles, persisted in IndexedDB so the
// list — and, where the browser supports it, a real handle to the file on disk
// — survives a page reload. See FileHistoryPanel for the UI this backs.
//
// Two independent ways to reopen an entry are kept per-row:
//  - `content`: a cached copy of the text, for instant "Open from Cache".
//  - `fileHandle`: a File System Access handle (Chromium only), for
//    "Open from File" — a genuine re-read from disk that fails if the file
//    has since moved or been deleted.

const DB_NAME = 'gpc-file-history'
const DB_VERSION = 1
const STORE_NAME = 'entries'

/** Most recent entries kept; oldest are evicted once this is exceeded. */
const MAX_ENTRIES = 10
/** Entries whose text exceeds this are kept (for the filename / file handle)
 *  but their cached copy is dropped — "Open from Cache" won't be offered. */
const MAX_CACHED_CONTENT_BYTES = 8 * 1024 * 1024

export type FileHistorySource = 'file' | 'paste'

export interface FileHistoryEntry {
  id: string
  filename: string
  label: string
  source: FileHistorySource
  openedAt: number
  /** Cached bundle text. Omitted when it exceeded the size cap. */
  content?: string
  /** Real handle to the file on disk, when the browser made one available. */
  fileHandle?: FileSystemFileHandle
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function byteLength(text: string): number {
  // An approximation is fine — this only gates an optional cache, not correctness.
  return new Blob([text]).size
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const req = fn(tx.objectStore(STORE_NAME))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function getAllEntries(): Promise<FileHistoryEntry[]> {
  try {
    return await withStore<FileHistoryEntry[]>('readonly', store => store.getAll())
  } catch {
    // IndexedDB can be unavailable (private browsing in some browsers, storage
    // disabled by policy) — degrade to "no history" rather than breaking the app.
    return []
  }
}

const listeners = new Set<() => void>()

/** Notified after any add/update/remove/clear, so open UI can re-read the list. */
export function subscribeFileHistory(callback: () => void): () => void {
  listeners.add(callback)
  return () => { listeners.delete(callback) }
}

function notifyListeners() {
  for (const cb of listeners) cb()
}

export async function listFileHistory(): Promise<FileHistoryEntry[]> {
  const entries = await getAllEntries()
  return entries.sort((a, b) => b.openedAt - a.openedAt)
}

export interface AddFileHistoryInput {
  filename: string
  label: string
  source: FileHistorySource
  content: string
  fileHandle?: FileSystemFileHandle
}

export async function addFileHistoryEntry(input: AddFileHistoryInput): Promise<void> {
  const entries = await getAllEntries()

  // Reopening the same on-disk file refreshes its existing row instead of piling up duplicates.
  const existing = input.source === 'file'
    ? entries.find(e => e.source === 'file' && e.filename === input.filename)
    : undefined

  const entry: FileHistoryEntry = {
    id: existing?.id ?? makeId(),
    filename: input.filename,
    label: input.label,
    source: input.source,
    openedAt: Date.now(),
    content: byteLength(input.content) <= MAX_CACHED_CONTENT_BYTES ? input.content : undefined,
    fileHandle: input.fileHandle,
  }

  const remaining = entries.filter(e => e.id !== entry.id)
  const next = [entry, ...remaining].sort((a, b) => b.openedAt - a.openedAt).slice(0, MAX_ENTRIES)
  const evicted = remaining.filter(e => !next.some(n => n.id === e.id))

  try {
    const db = await openDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(entry)
      for (const e of evicted) tx.objectStore(STORE_NAME).delete(e.id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    notifyListeners()
  } catch {
    // Best-effort only — failing to record history shouldn't block loading the bundle.
  }
}

/** Refreshes an entry's cached content and/or bumps it to the top after a successful reopen. */
export async function touchFileHistoryEntry(id: string, updates: Partial<Pick<FileHistoryEntry, 'content' | 'filename' | 'label'>> = {}): Promise<void> {
  const entries = await getAllEntries()
  const existing = entries.find(e => e.id === id)
  if (!existing) return
  const content = updates.content !== undefined
    ? (byteLength(updates.content) <= MAX_CACHED_CONTENT_BYTES ? updates.content : undefined)
    : existing.content
  const updated: FileHistoryEntry = { ...existing, ...updates, content, openedAt: Date.now() }
  try {
    await withStore('readwrite', store => store.put(updated))
    notifyListeners()
  } catch {
    // Best-effort — the reopen itself already succeeded by the time this is called.
  }
}

export async function removeFileHistoryEntry(id: string): Promise<void> {
  try {
    await withStore('readwrite', store => store.delete(id))
    notifyListeners()
  } catch {
    // Ignore — worst case the row lingers in the list.
  }
}

export async function clearFileHistory(): Promise<void> {
  try {
    await withStore('readwrite', store => store.clear())
    notifyListeners()
  } catch {
    // Ignore.
  }
}
