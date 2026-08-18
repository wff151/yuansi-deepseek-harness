/**
 * Dynamic context injection: the memory snapshot that reaches the model before
 * each step. The snapshot is assembled from the durable store, never from
 * process-local scratch, so a restart cannot silently drop remembered context.
 *
 * The context is registered as a `systemPrompt.context` contribution in the
 * caller's scope. When the `system-prompt` service is absent (headless
 * assemblies without the prompt seam), registration is skipped and the
 * snapshot is served through the memory service instead.
 * @module @deepseek-ai/dsh-memory/src/context
 */

import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-agent'
import type { MemoryStore } from './store.ts'
import { renderRetrievedContext } from './retrieval.ts'
import type { MemoryMode } from './types.ts'

/** Prompt-context order: after the harness identity, before tool guidance. */
export const MEMORY_CONTEXT_ORDER = 50

/** Prompt-context name used by the memory snapshot. */
export const MEMORY_CONTEXT_NAME = 'memory'

/** Render the per-session memory snapshot text for one open session. */
export function renderMemoryContext(store: MemoryStore, sessionId: SessionId): string {
  const lines: string[] = []
  const portable = store.getPortableDoc(sessionId)
  if (portable !== undefined) {
    lines.push(`[随身文档] ${portable.title}（第 ${portable.exchangeCount} 次交换）`)
    if (portable.goal) lines.push(`  目标：${portable.goal}`)
    if (portable.solvedProblems.length > 0) lines.push(`  已解决：${portable.solvedProblems.join('、')}`)
    if (portable.unresolvedProblems.length > 0) lines.push(`  待解决：${portable.unresolvedProblems.join('、')}`)
  }
  const profile = store.getPermanent('daily')
  const profileParts: string[] = []
  const attributes = Object.entries(profile.attributes)
  if (attributes.length > 0) {
    profileParts.push(`属性：${attributes.map(([k, v]) => `${k}=${String(v)}`).join('、')}`)
  }
  const preferences = Object.entries(profile.preferences)
  if (preferences.length > 0) {
    profileParts.push(`喜好：${preferences.map(([k, v]) => `${k}=${String(v)}`).join('、')}`)
  }
  if (profile.skills.length > 0) profileParts.push(`技能：${profile.skills.join('、')}`)
  if (profile.relationships.length > 0) profileParts.push(`关系：${profile.relationships.join('、')}`)
  if (profileParts.length > 0) lines.push(`[永久记忆] ${profileParts.join(' | ')}`)
  return lines.join('\n')
}

/**
 * Register the memory snapshot as a dynamic prompt context. The provider is
 * evaluated at each assembly for the owning agent, so the snapshot follows the
 * session's own memory.
 * @param ctx - registrant context carrying the prompt registry.
 * @param store - the opened memory store.
 */
export function registerMemoryContext(ctx: Context, store: MemoryStore): void {
  ctx.inject(['systemPrompt'], (promptCtx) => {
    promptCtx.systemPrompt.context({
      name: MEMORY_CONTEXT_NAME,
      order: MEMORY_CONTEXT_ORDER,
      text: (assemble) => {
        // The runtime toggle lives in the durable domain state, so a user can
        // switch injection on/off from the settings surface without a restart.
        if (!store.injectContext) return ''
        const sessionId = assemble.agent?.session.id
        if (sessionId === undefined) return ''
        return renderMemoryContext(store, sessionId)
      },
    })
  })
}

/** Render a retrieval-based memory hint for one user query. */
export function renderMemoryHint(store: MemoryStore, query: string, mode: MemoryMode | 'both' = 'both'): string {
  return renderRetrievedContext(store, query, { mode })
}
