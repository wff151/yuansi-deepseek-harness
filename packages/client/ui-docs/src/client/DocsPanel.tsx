/**
 * Portable-docs panel: the right-hand column that lists the memory system's
 * portable documents for the current session and lets the user read, edit, or
 * delete one. All data flows through the memory remote API; the host stays the
 * single fact source.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { MemoryEntryView } from '@deepseek-ai/dsh-api-remotes/client'
import {
  Button, IconChevronLeftOutline14, IconCloseOutline16, IconEditOutline16,
  IconListPenOutline16, IconRefreshOutline16, IconTrashOutline16, Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { messageOf } from './store.ts'
import type { DocsState, DocsStore } from './store.ts'
import type { en } from './locales.ts'
import css from './DocsPanel.module.css'

/** Injected dependencies of {@link DocsPanel} (slot `inject`). */
export interface DocsPanelInjected {
  /** The panel store (loaded on mount, refreshed on pushed invalidations). */
  controller: DocsStore
  /** uSES subscription hook bound to the store. */
  useSnapshot: SnapshotSelectorHook<DocsState>
  /** Close the docs column (layout geometry stays with ctx.layout). */
  closeDocs: () => void
  /** Panel copy. */
  t: (key: keyof typeof en) => string
}

/** Props delivered by the slot outlet: the inject face spread flat. */
export type DocsPanelProps = Partial<DocsPanelInjected>

/** Format an ISO timestamp for display. */
function formatTime(value: string | undefined): string {
  if (value === undefined || value === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Render the docs panel column. */
export function DocsPanel(props: DocsPanelProps): ReactNode {
  const { controller, useSnapshot, closeDocs, t } = props
  if (controller === undefined || useSnapshot === undefined || closeDocs === undefined || t === undefined) return null
  return <Loaded injected={{ controller, useSnapshot, closeDocs, t }} />
}

function Loaded({ injected }: { injected: DocsPanelInjected }): ReactNode {
  const { controller, closeDocs, t } = injected
  const state = injected.useSnapshot(snapshot => snapshot)
  const [editTarget, setEditTarget] = useState<MemoryEntryView | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<MemoryEntryView | undefined>(undefined)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailure, setDeleteFailure] = useState<string | undefined>(undefined)

  if (state.status === 'idle') void controller.load()

  const closeDelete = (): void => {
    if (deleting) return
    setDeleteTarget(undefined)
    setDeleteFailure(undefined)
  }

  const confirmDelete = (): void => {
    if (deleteTarget === undefined || deleting) return
    setDeleting(true)
    setDeleteFailure(undefined)
    void controller.deleteEntry(deleteTarget.id)
      .then(() => { setDeleteTarget(undefined) })
      .catch((error) => { setDeleteFailure(messageOf(error)) })
      .finally(() => { setDeleting(false) })
  }

  return (
    <div className={css.root}>
      <header className={css.header}>
        <span className={css.title}>
          <IconListPenOutline16 size={16} className={css.titleIcon} />
          {t('title')}
        </span>
        <div className={css.headerActions}>
          <button type="button" className={css.headerBtn} title={t('refresh')} onClick={() => { void controller.load() }}>
            <IconRefreshOutline16 size={16} />
          </button>
          <button type="button" className={css.headerBtn} title={t('close')} onClick={closeDocs}>
            <IconCloseOutline16 size={16} />
          </button>
        </div>
      </header>

      <div className={css.body}>
        {state.status === 'error' && (
          <div className={css.center}>
            <p className={css.error}>{`${t('loadFailed')}: ${state.error ?? ''}`}</p>
            <button type="button" className={css.retryBtn} onClick={() => { void controller.load() }}>
              {t('retry')}
            </button>
          </div>
        )}
        {state.status === 'ready' && !state.mounted && (
          <div className={css.center}>
            <div className={css.unavailable}>{t('loadFailed')}</div>
          </div>
        )}
        {state.status !== 'error' && state.mounted && (
          state.selectedId === undefined
            ? <DocList state={state} controller={controller} t={t} />
            : <DocDetail state={state} controller={controller} t={t} onEdit={setEditTarget} onDelete={setDeleteTarget} />
        )}
      </div>

      {/* Edit modal */}
      {editTarget !== undefined && (
        <EditModal
          entry={editTarget}
          controller={controller}
          t={t}
          onClose={() => { setEditTarget(undefined) }}
        />
      )}

      {/* Delete confirm modal */}
      <Modal
        open={deleteTarget !== undefined}
        onClose={closeDelete}
        title={t('deleteConfirmTitle')}
        closeLabel={t('close')}
        description={deleteTarget === undefined ? '' : t('deleteConfirmDescription')}
        footer={(
          <>
            <Button variant="outline" autoFocus disabled={deleting} onClick={closeDelete}>
              {t('cancel')}
            </Button>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? t('deleting') : t('deleteConfirm')}
            </Button>
          </>
        )}
      >
        {deleteFailure === undefined ? null : <p className={css.error}>{deleteFailure}</p>}
      </Modal>
    </div>
  )
}

/** The doc list view. */
function DocList({ state, controller, t }: {
  state: DocsState
  controller: DocsStore
  t: (key: keyof typeof en) => string
}): ReactNode {
  if (state.status === 'loading' && state.docs.length === 0) {
    return <div className={css.center}>{t('loading')}</div>
  }
  if (state.docs.length === 0) {
    return <div className={css.center}>{t('empty')}</div>
  }
  return (
    <ul className={css.list}>
      {state.docs.map(doc => (
        <li key={doc.id} className={css.docCard} onClick={() => { void controller.select(doc.id) }}>
          <div className={css.docTitle}>{doc.title}</div>
          <div className={css.docSummary}>{doc.summary}</div>
          <div className={css.docMeta}>{formatTime(doc.timestamp)}</div>
        </li>
      ))}
    </ul>
  )
}

/** The doc detail view. */
function DocDetail({ state, controller, t, onEdit, onDelete }: {
  state: DocsState
  controller: DocsStore
  t: (key: keyof typeof en) => string
  onEdit: (entry: MemoryEntryView) => void
  onDelete: (entry: MemoryEntryView) => void
}): ReactNode {
  const detail = state.detail
  if (detail === null) {
    return <div className={css.center}>{t('loading')}</div>
  }
  const data = detail.data
  const solved = Array.isArray(data.solvedProblems) ? data.solvedProblems as string[] : []
  const unresolved = Array.isArray(data.unresolvedProblems) ? data.unresolvedProblems as string[] : []
  const tags = Array.isArray(data.tags) ? data.tags as string[] : []
  const log = Array.isArray(data.log) ? data.log as Array<{ turn: number; user: string; time: string }> : []
  const exchangeCount = typeof data.exchangeCount === 'number' ? data.exchangeCount : log.length

  return (
    <div className={css.detail}>
      <div className={css.detailNav}>
        <button type="button" className={css.backBtn} onClick={() => { controller.back() }}>
          <IconChevronLeftOutline14 size={14} />
          {t('title')}
        </button>
        <div className={css.detailActions}>
          <button type="button" className={css.detailBtn} title={t('edit')} onClick={() => { onEdit(detail) }}>
            <IconEditOutline16 size={16} />
          </button>
          <button type="button" className={`${css.detailBtn} ${css.danger}`} title={t('delete')} onClick={() => { onDelete(detail) }}>
            <IconTrashOutline16 size={16} />
          </button>
        </div>
      </div>

      <div className={css.detailScroll}>
        <h3 className={css.detailTitle}>{detail.title}</h3>
        {typeof data.goal === 'string' && data.goal !== '' && (
          <div className={css.detailField}>
            <div className={css.detailLabel}>{t('docsGoal')}</div>
            <div className={css.detailValue}>{data.goal}</div>
          </div>
        )}
        {detail.summary !== '' && (
          <div className={css.detailField}>
            <div className={css.detailLabel}>{t('docsSummary')}</div>
            <div className={css.detailValue}>{detail.summary}</div>
          </div>
        )}
        {tags.length > 0 && (
          <div className={css.detailField}>
            <div className={css.detailLabel}>{t('docsTags')}</div>
            <div className={css.tagRow}>
              {tags.map(tag => <span key={tag} className={css.tagPill}>{tag}</span>)}
            </div>
          </div>
        )}
        <div className={css.detailField}>
          <div className={css.detailLabel}>{t('docsExchange')}</div>
          <div className={css.detailValue}>{exchangeCount}</div>
        </div>
        {solved.length > 0 && (
          <div className={css.detailField}>
            <div className={css.detailLabel}>{t('docsSolved')}</div>
            <ul className={css.problemList}>
              {solved.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </div>
        )}
        {unresolved.length > 0 && (
          <div className={css.detailField}>
            <div className={css.detailLabel}>{t('docsUnresolved')}</div>
            <ul className={css.problemList}>
              {unresolved.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </div>
        )}
        {log.length > 0 && (
          <div className={css.detailField}>
            <div className={css.detailLabel}>{t('docsLog')}</div>
            <ul className={css.logList}>
              {log.map((entry, index) => (
                <li key={index} className={css.logRow}>
                  <span className={css.logTurn}>#{entry.turn}</span>
                  <span className={css.logUser}>{entry.user}</span>
                  <span className={css.logTime}>{formatTime(entry.time)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/** Edit modal: patch writable fields of one portable doc. */
function EditModal({
  entry, controller, t, onClose,
}: {
  entry: MemoryEntryView
  controller: DocsStore
  t: (key: keyof typeof en) => string
  onClose: () => void
}): ReactNode {
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const data = entry.data
  const [title, setTitle] = useState(entry.title)
  const [summary, setSummary] = useState(entry.summary)
  const [goal, setGoal] = useState(typeof data.goal === 'string' ? data.goal : '')
  const [tags, setTags] = useState((Array.isArray(data.tags) ? data.tags as string[] : []).join(', '))
  const [solved, setSolved] = useState((Array.isArray(data.solvedProblems) ? data.solvedProblems as string[] : []).join('\n'))
  const [unresolved, setUnresolved] = useState((Array.isArray(data.unresolvedProblems) ? data.unresolvedProblems as string[] : []).join('\n'))

  const save = (): void => {
    if (saving) return
    setSaving(true)
    setFailure(undefined)
    const patch: Record<string, unknown> = {
      title: title.trim(),
      summary: summary.trim(),
      goal: goal.trim(),
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
      solvedProblems: solved.split('\n').map(item => item.trim()).filter(item => item.length > 0),
      unresolvedProblems: unresolved.split('\n').map(item => item.trim()).filter(item => item.length > 0),
    }
    void controller.updateEntry(entry.id, patch)
      .then(() => { onClose() })
      .catch((error) => { setFailure(messageOf(error)) })
      .finally(() => { setSaving(false) })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('editTitle')}
      closeLabel={t('close')}
      className={css.editModal as string}
      footer={(
        <>
          <Button variant="outline" autoFocus disabled={saving} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="outline" disabled={saving} onClick={save}>
            {saving ? t('saving') : t('save')}
          </Button>
        </>
      )}
    >
      <div>
        <div className={css.editField}>
          <label className={css.editLabel}>{t('editTitleField')}</label>
          <input className={css.editInput} value={title} onChange={e => { setTitle(e.target.value) }} />
        </div>
        <div className={css.editField}>
          <label className={css.editLabel}>{t('editGoal')}</label>
          <textarea className={css.editTextarea} value={goal} onChange={e => { setGoal(e.target.value) }} />
        </div>
        <div className={css.editField}>
          <label className={css.editLabel}>{t('editSummaryField')}</label>
          <textarea className={css.editTextarea} value={summary} onChange={e => { setSummary(e.target.value) }} />
        </div>
        <div className={css.editField}>
          <label className={css.editLabel}>{t('editTags')}</label>
          <input className={css.editInput} value={tags} onChange={e => { setTags(e.target.value) }} />
        </div>
        <div className={css.editField}>
          <label className={css.editLabel}>{t('docsSolved')}</label>
          <textarea className={css.editTextarea} value={solved} onChange={e => { setSolved(e.target.value) }} />
        </div>
        <div className={css.editField}>
          <label className={css.editLabel}>{t('docsUnresolved')}</label>
          <textarea className={css.editTextarea} value={unresolved} onChange={e => { setUnresolved(e.target.value) }} />
        </div>
        {failure !== undefined && <p className={css.error}>{failure}</p>}
      </div>
    </Modal>
  )
}
