/**
 * Memory settings page store: one snapshot joining the memory system status
 * and the memory entry list. The host stays the single fact source — every
 * mutation writes through the wire and the page re-renders from the next
 * fetch, pushed or refetched.
 */

import type { IApiClient, MemoryEntryView, MemoryStatusView } from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** Memory entry type discriminator (matches the wire projection). */
export type MemoryEntryType =
  | 'public'
  | 'short_term'
  | 'permanent'
  | 'portable_doc'
  | 'agent_evolution'

/** All supported entry types, in display order. */
export const MEMORY_TYPES: readonly MemoryEntryType[] = [
  'public',
  'short_term',
  'permanent',
  'portable_doc',
  'agent_evolution',
]

/** Page snapshot. */
export interface MemorySettingsState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Whole-load failure text. */
  error: string | null
  /** Whether the memory system is mounted at all. */
  mounted: boolean
  /** Status overview from the host. */
  overview: MemoryStatusView | null
  /** Currently selected entry type filter (undefined = all). */
  filter: MemoryEntryType | undefined
  /** Entries matching the current filter. */
  entries: readonly MemoryEntryView[]
}

/** Human text for a rejected wire call. */
export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The memory settings page controller (one per settings surface). */
export class MemorySettingsStore {
  /** The snapshot the section renders from (uSES-safe store). */
  readonly store: SnapshotStore<MemorySettingsState> = createSnapshotStore<MemorySettingsState>({
    status: 'idle', error: null, mounted: true, overview: null, filter: undefined, entries: [],
  })

  /** Latest load wins; an older response never overwrites a newer one. */
  private generation = 0

  /**
   * @param api - the wire face (memory domain).
   */
  constructor(private readonly api: Pick<IApiClient, 'memory'>) {}

  /**
   * Refresh the whole page snapshot: status and entry list in parallel.
   * A failure keeps the last good rows and surfaces the error.
   * @returns nothing; the snapshot carries the outcome.
   */
  async load(): Promise<void> {
    const generation = ++this.generation
    this.store.update((s) => { s.status = 'loading'; s.error = null })
    try {
      const filter = this.store.getSnapshot().filter
      const [statusResponse, listResponse] = await Promise.all([
        this.api.memory.status({}),
        this.api.memory.list({ ...(filter === undefined ? {} : { type: filter }), limit: 200 }),
      ])
      const statusResult = statusResponse.result
      if (!statusResult.ok) {
        if (statusResult.error.code === 'memory-unavailable') {
          if (generation !== this.generation) return
          this.store.update((s) => {
            s.status = 'ready'
            s.mounted = false
            s.overview = null
            s.entries = []
          })
          return
        }
        throw new Error(statusResult.error.message)
      }
      const listResult = listResponse.result
      if (!listResult.ok) throw new Error(listResult.error.message)
      if (generation !== this.generation) return
      this.store.update((s) => {
        s.status = 'ready'
        s.mounted = true
        s.overview = statusResult.value
        s.entries = listResult.value.entries
      })
    } catch (error) {
      if (generation !== this.generation) return
      this.store.update((s) => {
        s.status = 'error'
        s.error = messageOf(error)
      })
    }
  }

  /** Set the entry-type filter and reload the list. */
  async setFilter(filter: MemoryEntryType | undefined): Promise<void> {
    this.store.update((s) => { s.filter = filter })
    await this.load()
  }

  /** Toggle the prompt-context injection flag and refresh the overview. */
  async setInjectContext(value: boolean): Promise<void> {
    const response = await this.api.memory.config({ injectContext: value })
    if (!response.result.ok) throw new Error(response.result.error.message)
    await this.load()
  }

  /** Delete one memory entry and refresh the list. */
  async deleteEntry(type: MemoryEntryType, id: string): Promise<void> {
    const response = await this.api.memory.delete({ type, id })
    if (!response.result.ok) throw new Error(response.result.error.message)
    await this.load()
  }

  /** Update one memory entry and refresh the list. */
  async updateEntry(type: MemoryEntryType, id: string, patch: Record<string, unknown>): Promise<void> {
    const response = await this.api.memory.update({ type, id, patch })
    if (!response.result.ok) throw new Error(response.result.error.message)
    await this.load()
  }
}