/**
 * dsh-memory plugin entry: opens the memory domain, publishes the `memory`
 * service, registers the model-facing memory tools, and injects the memory
 * snapshot as dynamic prompt context.
 *
 * The store is opened during `apply` and closed via `ctx.effect` disposer, so
 * a plugin unmount drains queued writes.
 * @module @deepseek-ai/dsh-memory
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-storage-domain'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-tools'
import type { MemoryStore } from './store.ts'
import { registerMemoryTools } from './tools.ts'
import { registerMemoryContext } from './context.ts'

// The pure payload outlet (./types.ts, ONE home of the memory types) re-exported
// onto the package root keeps the module edge in the emitted index.d.ts, so
// aggregate programs consuming the declarations still receive the types.
export type * from './types.ts'
export {
  publicMemorySchema,
  shortTermItemSchema,
  permanentProfileSchema,
  portableDocSchema,
  agentEvolutionSchema,
  memoryDomainStateSchema,
  memoryDomainSpec,
} from './domain.ts'
export type {
  PublicMemoryRecord,
  ShortTermItemRecord,
  PermanentProfileRecord,
  PortableDocRecord,
} from './domain.ts'
export { MemoryStore } from './store.ts'
export { searchPublicMemory, searchShortTerm, renderRetrievedContext } from './retrieval.ts'
export { renderMemoryContext, renderMemoryHint } from './context.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    memory: MemoryFacility
  }
}

/** Cordis plugin name used by loader diagnostics. */
export const name = 'memory'

/** Services required before the plugin can activate. */
export const inject = ['storageDomain', 'tools']

/** Plugin configuration. */
export interface Config {
  /** Whether the memory snapshot is injected as a dynamic prompt context. */
  injectContext?: boolean
}

/** Schemastery validation for {@link Config}. */
export const Config: z<Config> = z.object({
  injectContext: z.boolean().default(true),
})

/** Resolved defaults. */
export interface ResolvedConfig {
  injectContext: boolean
}

/** The `ctx.memory` service: a thin facade over the opened memory store. */
export class MemoryFacility extends Service {
  /** The opened memory store; `undefined` before init completes. */
  opened?: MemoryStore

  constructor(ctx: Context) {
    super(ctx, 'memory')
  }

  /** The opened memory store; `undefined` before init completes. */
  get store(): MemoryStore | undefined {
    return this.opened
  }
}

/**
 * Mount the memory plugin: open the domain, provide the service, register
 * tools and prompt context.
 * @param ctx - registrant context.
 * @param config - validated plugin configuration.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const resolved: ResolvedConfig = {
    injectContext: config.injectContext ?? true,
  }

  const { MemoryStore } = await import('./store.ts')
  const store = await MemoryStore.open(ctx)
  ctx.effect(() => () => store.close(), 'memory.domainClose')

  // The Service constructor registers `ctx.memory` in the current fiber.
  const facility = new MemoryFacility(ctx)
  facility.opened = store

  registerMemoryTools(ctx, store)

  // Auto-record every user exchange into the session's portable doc. The
  // portable doc is the session's working memory; relying on the model to call
  // memory_portable_doc leaves it empty for models that never invoke the tool.
  ctx.on('agent/inbox/claimed', ({ agent, message }) => {
    if (message.source.kind !== 'user') return
    const text = message.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map(block => block.text)
      .join('\n')
    if (text.trim() === '') return
    void store.recordExchange(agent.session.id, text).catch((error: unknown) => {
      ctx.logger.warn(`memory: auto-record exchange failed: ${String(error)}`)
    })
  })

  if (resolved.injectContext) {
    registerMemoryContext(ctx, store)
  }
}