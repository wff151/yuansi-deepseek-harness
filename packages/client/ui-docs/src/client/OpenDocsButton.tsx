/**
 * Session-header action that opens the portable-docs column. A plain trigger:
 * the panel content and the layout geometry both live elsewhere, so this
 * component carries no state of its own.
 */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconListPenOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the ui-conversation SlotMap merge (the header actions).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { DocsKey } from './locales.ts'
import css from './OpenDocsButton.module.css'

/** Full props for the session-header portable-docs action. */
export type OpenDocsButtonProps =
  PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<'docs'>
  & { openDocs: () => void }

/**
 * Render the trigger that opens the portable-docs column.
 * @param props - runtime slot currency plus the open callback.
 * @returns the header button.
 */
export function OpenDocsButton({ openDocs, t }: OpenDocsButtonProps) {
  return (
    <button
      type="button"
      className={css.trigger}
      title={t('openPanelHint' as DocsKey)}
      aria-label={t('openPanel' as DocsKey)}
      onClick={openDocs}
    >
      <IconListPenOutline16 size={16} className={css.icon} />
      <span className={css.label}>{t('openPanel' as DocsKey)}</span>
    </button>
  )
}
