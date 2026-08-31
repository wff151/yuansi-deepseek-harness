/**
 * Portable-docs plugin, browser half. It registers the docs panel into the
 * layout's `docs` column and a session-header action that opens that column.
 * Export discipline: packages/client/AGENTS.md.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the ui-layout SlotMap merge (the 'docs' entry) and ctx.layout.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the ui-conversation SlotMap merge (the header actions).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ctx.remote merge into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { DocsPanel } from './DocsPanel.tsx'
import type { DocsPanelInjected } from './DocsPanel.tsx'
import { OpenDocsButton } from './OpenDocsButton.tsx'
import { DocsStore } from './store.ts'
import { en, zh, type DocsKey } from './locales.ts'

export type { DocsPanelInjected, DocsPanelProps } from './DocsPanel.tsx'
export type { OpenDocsButtonProps } from './OpenDocsButton.tsx'
export type { DocsKey } from './locales.ts'
export type { DocsState } from './store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The portable-docs panel copy. */
    'docs': DocsKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'docs'

/**
 * Required services (cordis fiber inject). The target slots are declared by
 * ui-layout and ui-conversation, whose activation order relative to this one
 * is NOT constrained; registration depends on each slot through `slots.inject()`.
 */
export const inject = ['slots', 'locale', 'connection', 'remote', 'layout']

/**
 * Register the docs panel and the header trigger once their slots are on the
 * ledger, and wire the panel store to the connection.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-docs: copy dictionaries')

  const connection = ctx.get('connection') as ConnectionHandle
  const controller = new DocsStore(connection.api)
  const useSnapshot = bindSnapshotSelector(controller.store)
  const t = ctx.locale.bind(NS) as DocsPanelInjected['t']
  const injected = (): DocsPanelInjected => ({
    controller,
    useSnapshot,
    closeDocs: () => { ctx.layout.closeDocs() },
    t,
  })

  ctx.effect(() => {
    const refresh = (): void => {
      // Only refetch after the panel's first load: an unopened panel must not
      // fetch on background invalidations.
      if (controller.store.getSnapshot().status === 'idle') return
      void controller.load()
    }
    const disposers = [
      ctx.remote.$on('settings/document-updated', refresh),
      ctx.on('connection/reset', refresh),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'ui-docs: pushed invalidations')

  ctx.slots.inject('docs', () => ctx.slots.register({
    name: 'docs',
    locale: NS,
    inject: injected,
  }, DocsPanel))

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'portable-docs',
    // After the interactive actions (agent preset label sits at -10; this is
    // a user-triggered control, so it belongs in the positive band).
    order: 30,
    locale: NS,
    inject: (): { openDocs: () => void } => ({
      openDocs: () => { ctx.layout.openDocs() },
    }),
  }, OpenDocsButton))
}
