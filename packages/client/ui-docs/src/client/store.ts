/**
 * Portable-docs panel store: the portable_doc entry list plus the selected
 * entry's full detail. The host stays the single fact source — every mutation
 * writes through the wire and the panel re-renders from the next fetch.
 */

import type { IApiClient, MemoryEntryView } from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** Panel snapshot. */
export interface DocsState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Whole-load failure text. */
  error: string | null
  /** Whether the memory system is mounted at all. */
  mounted: boolean
  /** Portable-doc entries (list projection). */
  docs: readonly MemoryEntryView[]
  /** Currently selected doc id (undefined = list view). */
  selectedId: string | undefined
  /** Full detail of the selected doc. */
  detail: MemoryEntryView | null
}

/** Human text for a rejected wire call. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The portable-docs panel controller (one per docs surface). */
export class DocsStore {
  /** The snapshot the panel renders from (uSES-safe store). */
  readonly store: SnapshotStore<DocsState> = createSnapshotStore<DocsState>({
    status: 'idle', error: null, mounted: true, docs: [], selectedId: undefined, detail: null,
  })

  /** Latest load wins; an older response never overwrites a newer one. */
  private generation = 0

  /**
   * @param api - the wire face (memory domain).
   */
  constructor(private readonly api: Pick<IApiClient, 'memory'>) {}

  /**
   * Refresh the doc list. A failure keeps the last good rows and surfaces the
   * error.
   * @returns nothing; the snapshot carries the outcome.
   */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.update((s) => { s.status = 'loading'; s.error = null })
    try {
      const response = await this.api.memory.list({ type: 'portable_doc', limit: 200 })
      const result = response.result
      if (!result.ok) {
        if (result.error.code === 'memory-unavailable') {
          if (generation !== this.generation) return
          this.store.update((s) => {
            s.status = 'ready'
            s.mounted = false
            s.docs = []
            s.detail = null
          })
          return
        }
        throw new Error(result.error.message)
      }
      if (generation !== this.generation) return
      this.store.update((s) => {
        s.status = 'ready'
        s.mounted = true
        s.docs = result.value.entries
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((s) => {
        s.status = 'error'
        s.error = messageOf(error)
      })
    }
  }

  /**
   * Select a doc and fetch its full detail.
   * @param id - the portable-doc entry id (sessionId).
   */
  async select(id: string): Promise<void> {
    const generation = ++this.generation
    this.store.update((s) => { s.selectedId = id; s.detail = null })
    try {
      const response = await this.api.memory.get({ type: 'portable_doc', id })
      const result = response.result
      if (!result.ok) throw new Error(result.error.message)
      if (generation !== this.generation) return
      this.store.update((s) => { s.detail = result.value })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((s) => {
        s.status = 'error'
        s.error = messageOf(error)
      })
    }
  }

  /** Return to the list view. */
  back(): void {
    this.store.update((s) => { s.selectedId = undefined; s.detail = null })
  }

  /** Update one doc and refresh the list. */
  async updateEntry(id: string, patch: Record<string, unknown>): Promise<void> {
    const response = await this.api.memory.update({ type: 'portable_doc', id, patch })
    if (!response.result.ok) throw new Error(response.result.error.message)
    await this.load()
  }

  /** Delete one doc and refresh the list. */
  async deleteEntry(id: string): Promise<void> {
    const response = await this.api.memory.delete({ type: 'portable_doc', id })
    if (!response.result.ok) throw new Error(response.result.error.message)
    this.back()
    await this.load()
  }
}
