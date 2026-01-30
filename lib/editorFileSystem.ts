'use client'

/**
 * Editor File System Client Utilities
 *
 * Client-side utilities and React hooks for the VS Code-like file editor API.
 * Provides file CRUD operations, search, and real-time sync via SSE or polling.
 *
 * @example
 * ```tsx
 * import { useEditorFileSystem, useFileWatcher, useFileTree } from '@/lib/editorFileSystem'
 *
 * // CRUD operations
 * const { listFiles, readFile, createFile, updateFile, deleteFile } = useEditorFileSystem()
 *
 * // Real-time sync
 * useFileWatcher({ mode: 'auto', onFileChange: (event) => console.log(event) })
 *
 * // File tree with auto-refresh
 * const { tree, loading, refresh } = useFileTree()
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// =============================================================================
// Types
// =============================================================================

export type FileType = 'file' | 'directory' | 'symlink'
export type FileChangeType = 'created' | 'modified' | 'deleted' | 'renamed'

export interface FileEntry {
  name: string
  path: string
  type: FileType
  size?: number
  modified_at?: string
  language?: string
  checksum?: string
}

export interface FileMetadata extends FileEntry {
  created_at?: string
  permissions?: string
  encoding?: string
  line_count?: number
  is_binary: boolean
}

export interface FileTreeNode {
  name: string
  path: string
  type: FileType
  size?: number
  modified_at?: string
  language?: string
  children?: FileTreeNode[]
  expanded?: boolean
}

export interface FileChangeEvent {
  type: FileChangeType
  path: string
  old_path?: string
  checksum?: string
  timestamp: string
}

export interface SearchMatch {
  line_number: number
  line_content: string
  match_start: number
  match_end: number
  context_before: string[]
  context_after: string[]
}

export interface SearchFileResult {
  path: string
  matches: SearchMatch[]
  match_count: number
}

// Response types
export interface ListFilesResponse {
  success: boolean
  path: string
  entries: FileEntry[]
  total_count: number
  message?: string
  error?: string
}

export interface ReadFileResponse {
  success: boolean
  path: string
  content?: string
  encoding?: string
  checksum?: string
  language?: string
  line_count?: number
  size?: number
  is_binary?: boolean
  message?: string
  error?: string
}

export interface WriteFileResponse {
  success: boolean
  path: string
  checksum?: string
  size?: number
  created?: boolean
  message?: string
  error?: string
  conflict?: boolean
}

export interface DeleteFileResponse {
  success: boolean
  path: string
  deleted_count: number
  message?: string
  error?: string
}

export interface MoveFileResponse {
  success: boolean
  source_path: string
  destination_path: string
  message?: string
  error?: string
}

export interface SearchFilesResponse {
  success: boolean
  query: string
  results: SearchFileResult[]
  total_matches: number
  files_searched: number
  files_with_matches: number
  truncated: boolean
  message?: string
  error?: string
}

export interface FileTreeResponse {
  success: boolean
  tree?: FileTreeNode
  checksum?: string
  timestamp: string
  message?: string
  error?: string
}

export interface FileMetadataResponse {
  success: boolean
  metadata?: FileMetadata
  message?: string
  error?: string
}

export interface PollChangesResponse {
  success: boolean
  changes: FileChangeEvent[]
  current_checksum: string
  timestamp: string
  message?: string
  error?: string
}

// =============================================================================
// API Functions
// =============================================================================

const API_BASE = '/api/editor'

/**
 * List files in a directory
 */
export async function listFiles(options?: {
  path?: string
  recursive?: boolean
  depth?: number
  include_hidden?: boolean
}): Promise<ListFilesResponse> {
  const params = new URLSearchParams()
  if (options?.path) params.set('path', options.path)
  if (options?.recursive) params.set('recursive', 'true')
  if (options?.depth !== undefined) params.set('depth', String(options.depth))
  if (options?.include_hidden) params.set('include_hidden', 'true')

  try {
    const res = await fetch(`${API_BASE}/files?${params}`)
    return await res.json()
  } catch (error) {
    return {
      success: false,
      path: options?.path || '/',
      entries: [],
      total_count: 0,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Read file content
 */
export async function readFile(
  path: string,
  options?: {
    encoding?: string
    range_start?: number
    range_end?: number
  }
): Promise<ReadFileResponse> {
  const params = new URLSearchParams({ path })
  if (options?.encoding) params.set('encoding', options.encoding)
  if (options?.range_start !== undefined) params.set('range_start', String(options.range_start))
  if (options?.range_end !== undefined) params.set('range_end', String(options.range_end))

  try {
    const res = await fetch(`${API_BASE}/file?${params}`)
    return await res.json()
  } catch (error) {
    return {
      success: false,
      path,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Create a new file
 */
export async function createFile(
  path: string,
  content: string = '',
  options?: {
    create_directories?: boolean
    overwrite?: boolean
  }
): Promise<WriteFileResponse> {
  try {
    const res = await fetch(`${API_BASE}/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        content,
        create_directories: options?.create_directories ?? true,
        overwrite: options?.overwrite ?? false,
      }),
    })
    return await res.json()
  } catch (error) {
    return {
      success: false,
      path,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Update file content
 */
export async function updateFile(
  path: string,
  content: string,
  expectedChecksum?: string
): Promise<WriteFileResponse> {
  try {
    const res = await fetch(`${API_BASE}/file`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path,
        content,
        expected_checksum: expectedChecksum,
      }),
    })
    return await res.json()
  } catch (error) {
    return {
      success: false,
      path,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Delete a file or directory
 */
export async function deleteFile(
  path: string,
  recursive: boolean = false
): Promise<DeleteFileResponse> {
  const params = new URLSearchParams({ path })
  if (recursive) params.set('recursive', 'true')

  try {
    const res = await fetch(`${API_BASE}/file?${params}`, {
      method: 'DELETE',
    })
    return await res.json()
  } catch (error) {
    return {
      success: false,
      path,
      deleted_count: 0,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Move or rename a file
 */
export async function moveFile(
  sourcePath: string,
  destinationPath: string,
  overwrite: boolean = false
): Promise<MoveFileResponse> {
  try {
    const res = await fetch(`${API_BASE}/file/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_path: sourcePath,
        destination_path: destinationPath,
        overwrite,
      }),
    })
    return await res.json()
  } catch (error) {
    return {
      success: false,
      source_path: sourcePath,
      destination_path: destinationPath,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Search files for content
 */
export async function searchFiles(
  query: string,
  options?: {
    path?: string
    patterns?: string[]
    regex?: boolean
    case_sensitive?: boolean
    context_lines?: number
    max_results?: number
  }
): Promise<SearchFilesResponse> {
  try {
    const res = await fetch(`${API_BASE}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        path: options?.path || '/',
        patterns: options?.patterns,
        regex: options?.regex ?? false,
        case_sensitive: options?.case_sensitive ?? false,
        context_lines: options?.context_lines ?? 2,
        max_results: options?.max_results ?? 100,
      }),
    })
    return await res.json()
  } catch (error) {
    return {
      success: false,
      query,
      results: [],
      total_matches: 0,
      files_searched: 0,
      files_with_matches: 0,
      truncated: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Get file tree structure
 */
export async function getFileTree(options?: {
  path?: string
  depth?: number
  include_hidden?: boolean
}): Promise<FileTreeResponse> {
  const params = new URLSearchParams()
  if (options?.path) params.set('path', options.path)
  if (options?.depth !== undefined) params.set('depth', String(options.depth))
  if (options?.include_hidden) params.set('include_hidden', 'true')

  try {
    const res = await fetch(`${API_BASE}/tree?${params}`)
    return await res.json()
  } catch (error) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(path: string): Promise<FileMetadataResponse> {
  const params = new URLSearchParams({ path })

  try {
    const res = await fetch(`${API_BASE}/file/metadata?${params}`)
    return await res.json()
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Poll for file changes
 */
export async function pollChanges(options?: {
  path?: string
  since_timestamp?: string
  last_checksum?: string
}): Promise<PollChangesResponse> {
  const params = new URLSearchParams()
  if (options?.path) params.set('path', options.path)
  if (options?.since_timestamp) params.set('since_timestamp', options.since_timestamp)
  if (options?.last_checksum) params.set('last_checksum', options.last_checksum)

  try {
    const res = await fetch(`${API_BASE}/poll?${params}`)
    return await res.json()
  } catch (error) {
    return {
      success: false,
      changes: [],
      current_checksum: '',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

// =============================================================================
// React Hooks
// =============================================================================

/**
 * Hook for file system CRUD operations with loading/error state
 */
export function useEditorFileSystem() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const withLoading = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      setLoading(true)
      setError(null)
      try {
        return await operation()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return {
    loading,
    error,
    listFiles: useCallback(
      (options?: Parameters<typeof listFiles>[0]) => withLoading(() => listFiles(options)),
      [withLoading]
    ),
    readFile: useCallback(
      (path: string, options?: Parameters<typeof readFile>[1]) =>
        withLoading(() => readFile(path, options)),
      [withLoading]
    ),
    createFile: useCallback(
      (path: string, content?: string, options?: Parameters<typeof createFile>[2]) =>
        withLoading(() => createFile(path, content, options)),
      [withLoading]
    ),
    updateFile: useCallback(
      (path: string, content: string, expectedChecksum?: string) =>
        withLoading(() => updateFile(path, content, expectedChecksum)),
      [withLoading]
    ),
    deleteFile: useCallback(
      (path: string, recursive?: boolean) => withLoading(() => deleteFile(path, recursive)),
      [withLoading]
    ),
    moveFile: useCallback(
      (source: string, dest: string, overwrite?: boolean) =>
        withLoading(() => moveFile(source, dest, overwrite)),
      [withLoading]
    ),
    searchFiles: useCallback(
      (query: string, options?: Parameters<typeof searchFiles>[1]) =>
        withLoading(() => searchFiles(query, options)),
      [withLoading]
    ),
    getMetadata: useCallback(
      (path: string) => withLoading(() => getFileMetadata(path)),
      [withLoading]
    ),
  }
}

/**
 * Watcher mode configuration
 */
export type WatcherMode = 'sse' | 'poll' | 'auto'

export interface UseFileWatcherOptions {
  /** Watch mode: 'sse' (real-time), 'poll' (interval), or 'auto' (SSE with fallback) */
  mode?: WatcherMode
  /** Polling interval in ms (for 'poll' and 'auto' fallback) */
  interval?: number
  /** Callback when file changes occur */
  onFileChange?: (event: FileChangeEvent) => void
  /** Callback on connection error */
  onError?: (error: string) => void
  /** Callback on connection state change */
  onConnectionChange?: (connected: boolean) => void
  /** Path to watch */
  path?: string
  /** Enable/disable the watcher */
  enabled?: boolean
}

/**
 * Hook for real-time file watching with SSE and polling fallback
 */
export function useFileWatcher(options: UseFileWatcherOptions = {}) {
  const {
    mode = 'auto',
    interval = 3000,
    onFileChange,
    onError,
    onConnectionChange,
    path = '/',
    enabled = true,
  } = options

  const [connected, setConnected] = useState(false)
  const [usingSSE, setUsingSSE] = useState(mode !== 'poll')
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastChecksumRef = useRef<string>('')
  const lastTimestampRef = useRef<string>('')

  // Cleanup function
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }, [])

  // Start SSE connection
  const startSSE = useCallback(() => {
    cleanup()

    const params = new URLSearchParams({ path })
    const eventSource = new EventSource(`${API_BASE}/watch?${params}`)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setConnected(true)
      setUsingSSE(true)
      onConnectionChange?.(true)
    }

    eventSource.onerror = () => {
      setConnected(false)
      onConnectionChange?.(false)

      // Auto fallback to polling
      if (mode === 'auto') {
        eventSource.close()
        eventSourceRef.current = null
        setUsingSSE(false)
        startPolling()
      } else {
        onError?.('SSE connection failed')
      }
    }

    eventSource.addEventListener('file_changed', (event) => {
      try {
        const data = JSON.parse(event.data)
        const changeEvent: FileChangeEvent = data.data || data
        onFileChange?.(changeEvent)
      } catch (e) {
        console.error('Failed to parse file change event:', e)
      }
    })

    eventSource.addEventListener('connected', () => {
      setConnected(true)
      onConnectionChange?.(true)
    })
  }, [path, mode, onFileChange, onError, onConnectionChange, cleanup])

  // Start polling
  const startPolling = useCallback(() => {
    cleanup()

    const poll = async () => {
      try {
        const result = await pollChanges({
          path,
          since_timestamp: lastTimestampRef.current || undefined,
          last_checksum: lastChecksumRef.current || undefined,
        })

        if (result.success) {
          setConnected(true)
          onConnectionChange?.(true)

          lastChecksumRef.current = result.current_checksum
          lastTimestampRef.current = result.timestamp

          for (const change of result.changes) {
            onFileChange?.(change)
          }
        } else {
          onError?.(result.error || 'Polling failed')
        }
      } catch (e) {
        setConnected(false)
        onConnectionChange?.(false)
        onError?.(e instanceof Error ? e.message : 'Polling failed')
      }
    }

    // Initial poll
    poll()

    // Set up interval
    pollIntervalRef.current = setInterval(poll, interval)
  }, [path, interval, onFileChange, onError, onConnectionChange, cleanup])

  // Start watching
  useEffect(() => {
    if (!enabled) {
      cleanup()
      setConnected(false)
      return
    }

    if (mode === 'poll') {
      startPolling()
    } else {
      startSSE()
    }

    return cleanup
  }, [enabled, mode, startSSE, startPolling, cleanup])

  return {
    connected,
    usingSSE,
    reconnect: useCallback(() => {
      if (mode === 'poll' || !usingSSE) {
        startPolling()
      } else {
        startSSE()
      }
    }, [mode, usingSSE, startSSE, startPolling]),
    disconnect: cleanup,
  }
}

/**
 * Hook for file tree with auto-refresh on changes
 */
export function useFileTree(options?: {
  path?: string
  depth?: number
  include_hidden?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}) {
  const {
    path = '/',
    depth,
    include_hidden = false,
    autoRefresh = true,
    refreshInterval = 5000,
  } = options || {}

  const [tree, setTree] = useState<FileTreeNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [checksum, setChecksum] = useState<string>('')
  const checksumRef = useRef<string>('')

  const refresh = useCallback(async () => {
    try {
      const result = await getFileTree({ path, depth, include_hidden })

      if (result.success && result.tree) {
        setTree(result.tree)
        setChecksum(result.checksum || '')
        checksumRef.current = result.checksum || ''
        setError(null)
      } else {
        setError(result.error || 'Failed to load file tree')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load file tree')
    } finally {
      setLoading(false)
    }
  }, [path, depth, include_hidden])

  // Initial load
  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  // Auto-refresh using file watcher
  useFileWatcher({
    mode: 'auto',
    path,
    interval: refreshInterval,
    enabled: autoRefresh,
    onFileChange: () => {
      refresh()
    },
  })

  return {
    tree,
    loading,
    error,
    checksum,
    refresh,
  }
}

/**
 * Hook for managing a single file with auto-save
 */
export function useFile(filePath: string, options?: {
  autoSave?: boolean
  autoSaveDelay?: number
}) {
  const { autoSave = false, autoSaveDelay = 1000 } = options || {}

  const [content, setContent] = useState<string>('')
  const [originalContent, setOriginalContent] = useState<string>('')
  const [checksum, setChecksum] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [metadata, setMetadata] = useState<ReadFileResponse | null>(null)

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Load file
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const result = await readFile(filePath)

    if (result.success && result.content !== undefined) {
      setContent(result.content)
      setOriginalContent(result.content)
      setChecksum(result.checksum || '')
      setMetadata(result)
      setIsDirty(false)
    } else {
      setError(result.error || 'Failed to load file')
    }

    setLoading(false)
  }, [filePath])

  // Save file
  const save = useCallback(async () => {
    if (!isDirty) return { success: true, path: filePath }

    setSaving(true)
    setError(null)

    const result = await updateFile(filePath, content, checksum)

    if (result.success) {
      setOriginalContent(content)
      setChecksum(result.checksum || '')
      setIsDirty(false)
    } else if (result.conflict) {
      setError('File was modified externally. Please reload.')
    } else {
      setError(result.error || 'Failed to save file')
    }

    setSaving(false)
    return result
  }, [filePath, content, checksum, isDirty])

  // Update content
  const updateContent = useCallback(
    (newContent: string) => {
      setContent(newContent)
      setIsDirty(newContent !== originalContent)

      // Auto-save
      if (autoSave && newContent !== originalContent) {
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current)
        }
        autoSaveTimerRef.current = setTimeout(() => {
          save()
        }, autoSaveDelay)
      }
    },
    [originalContent, autoSave, autoSaveDelay, save]
  )

  // Reload from disk
  const reload = useCallback(async () => {
    const result = await readFile(filePath)
    if (result.success && result.content !== undefined) {
      setContent(result.content)
      setOriginalContent(result.content)
      setChecksum(result.checksum || '')
      setIsDirty(false)
      setError(null)
    }
  }, [filePath])

  // Initial load
  useEffect(() => {
    load()
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current)
      }
    }
  }, [load])

  return {
    content,
    setContent: updateContent,
    originalContent,
    checksum,
    loading,
    saving,
    error,
    isDirty,
    metadata,
    save,
    reload,
    load,
  }
}
