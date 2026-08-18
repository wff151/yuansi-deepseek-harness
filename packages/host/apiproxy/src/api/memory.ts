/**
 * memory domain contract: the web face of the durable memory system. Every
 * method reads from or writes to the memory domain through ctx.memory.store.
 * The memory plugin is optional; absent returns `memory-unavailable`.
 */

import type { RpcRequest, RpcResponse } from './rpc.ts'

/** Memory system status overview. */
export interface MemoryStatusView {
  /** Total memory writes across all subsystems. */
  memoryCount: number
  /** Last write timestamp, absent when no write has occurred. */
  lastWriteAt?: string
  /** Whether prompt-context injection is enabled. */
  injectContext: boolean
  /** Counts per subsystem. */
  counts: {
    public: number
    shortTerm: number
    permanent: number
    portable: number
    evolution: number
  }
}

/** One memory entry in a list response — the common projection. */
export interface MemoryEntryView {
  /** Memory type discriminator. */
  type: 'public' | 'short_term' | 'permanent' | 'portable_doc' | 'agent_evolution'
  /** Entry id (memory_id for public, id for short-term, mode for permanent, sessionId for portable, id for evolution). */
  id: string
  /** Title or display name. */
  title: string
  /** Summary or content preview. */
  summary: string
  /** Timestamp the entry was created. */
  timestamp: string
  /** Tags, when applicable. */
  tags?: readonly string[]
  /** Memory mode, when applicable. */
  mode?: 'daily' | 'work'
  /** Raw entry data (full record). */
  data: Record<string, unknown>
}

/** Memory domain unary methods (the map keys memory.* of RpcMethodMap). */
export interface MemoryApi {
  /**
   * Return the memory system status: total count, last write, injection toggle,
   * and per-subsystem counts.
   */
  status(request: RpcRequest<{}>): Promise<RpcResponse<MemoryStatusView>>

  /**
   * List memory entries by type. Omitting `type` returns all entries.
   */
  list(request: RpcRequest<{ type?: string; mode?: string; limit?: number }>):
    Promise<RpcResponse<{ entries: readonly MemoryEntryView[] }>>

  /**
   * Get one memory entry by type and id.
   */
  get(request: RpcRequest<{ type: string; id: string }>):
    Promise<RpcResponse<MemoryEntryView>>

  /**
   * Delete one memory entry by type and id.
   */
  delete(request: RpcRequest<{ type: string; id: string }>):
    Promise<RpcResponse<{ deleted: boolean }>>

  /**
   * Update one memory entry by type and id. The patch is a partial record
   * whose fields overwrite the stored ones.
   */
  update(request: RpcRequest<{ type: string; id: string; patch: Record<string, unknown> }>):
    Promise<RpcResponse<MemoryEntryView>>

  /**
   * Toggle the prompt-context injection flag.
   */
  config(request: RpcRequest<{ injectContext?: boolean }>):
    Promise<RpcResponse<{ injectContext: boolean }>>
}