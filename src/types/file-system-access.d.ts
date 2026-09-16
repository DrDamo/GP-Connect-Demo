// Ambient additions for parts of the File System Access API that this
// project's TypeScript lib.dom.d.ts doesn't yet type: `window.showOpenFilePicker`,
// permission queries on a handle, and recovering a handle from a drag-and-drop
// event. All Chromium-only — every call site feature-detects before use, so
// these being `undefined` at runtime in other browsers is expected and safe.
export {}

declare global {
  interface FileSystemHandlePermissionDescriptor {
    mode?: 'read' | 'readwrite'
  }

  interface FileSystemHandle {
    queryPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
    requestPermission?(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  }

  interface DataTransferItem {
    getAsFileSystemHandle?(): Promise<FileSystemHandle | null>
  }

  interface FilePickerAcceptType {
    description?: string
    accept: Record<string, string | string[]>
  }

  interface OpenFilePickerOptions {
    types?: FilePickerAcceptType[]
    excludeAcceptAllOption?: boolean
    multiple?: boolean
  }

  interface Window {
    showOpenFilePicker?(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
  }
}
