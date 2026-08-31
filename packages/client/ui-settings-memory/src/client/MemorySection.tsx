/**
 * Memory settings section: status overview, prompt-context injection toggle,
 * and memory entry management (filter by type, view detail, edit, delete).
 * All data flows through the memory remote API; the host stays the single
 * fact source.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'
import type { IApiClient, MemoryEntryView } from '@deepseek-ai/dsh-api-remotes/client'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-renderer/client'
import { MEMORY_TYPES, messageOf } from './store.ts'
import type { MemoryEntryType, MemorySettingsState, MemorySettingsStore } from './store.ts'
import type { en } from './locales.ts'
import css from './MemorySection.module.css'

/** Injected dependencies of {@link MemorySection} (slot `inject`). */
export interface MemorySectionInjected {
  /** The page store (loaded on mount, refreshed on pushed invalidations). */
  controller: MemorySettingsStore
  /** uSES subscription hook bound to the store. */
  useSnapshot: SnapshotSelectorHook<MemorySettingsState>
  /** Wire faces the section writes through. */
  api: Pick<IApiClient, 'memory'>
  /** Section copy. */
  t: (key: keyof typeof en) => string
}

/** Props delivered by the slot outlet: the inject face spread flat. */
export type MemorySectionProps = Partial<MemorySectionInjected>

/** One entry addressed by an action. */
interface EntryTarget {
  type: MemoryEntryType
  id: string
  title: string
}

/** Format an ISO timestamp for display. */
function formatTime(value: string | undefined): string {
  if (value === undefined || value === '') return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Render the section content column. */
export function MemorySection(props: MemorySectionProps): ReactNode {
  const { controller, useSnapshot, api, t } = props
  if (controller === undefined || useSnapshot === undefined || api === undefined || t === undefined) return null
  return <Loaded injected={{ controller, useSnapshot, api, t }} />
}

function Loaded({ injected }: { injected: MemorySectionInjected }): ReactNode {
  const { controller, t } = injected
  const state = injected.useSnapshot(snapshot => snapshot)
  const [detailTarget, setDetailTarget] = useState<EntryTarget | undefined>(undefined)
  const [editTarget, setEditTarget] = useState<EntryTarget | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<EntryTarget | undefined>(undefined)
  const [deleting, setDeleting] = useState(false)
  const [deleteFailure, setDeleteFailure] = useState<string | undefined>(undefined)
  const [toggling, setToggling] = useState(false)
  const [toggleError, setToggleError] = useState<string | undefined>(undefined)

  if (state.status === 'idle') void controller.load()
  if (state.status === 'error') {
    const errorText = state.error ?? ''
    return (
      <div className={css.section}>
        <p className={css.error}>{`${t('loadFailed')}: ${errorText}`}</p>
        <button type="button" className={css.retryBtn} onClick={() => { void controller.load() }}>
          {t('retry')}
        </button>
      </div>
    )
  }
  if (state.status === 'ready' && !state.mounted) {
    return (
      <div className={css.section}>
        <div className={css.unavailable}>
          <div className={css.unavailableIcon}>🧠</div>
          <div className={css.unavailableTitle}>{t('unavailable')}</div>
          <p className={css.configHint}>{t('unavailableHint')}</p>
        </div>
      </div>
    )
  }

  const overview = state.overview
  const counts = overview?.counts

  const closeDelete = (): void => {
    if (deleting) return
    setDeleteTarget(undefined)
    setDeleteFailure(undefined)
  }

  const confirmDelete = (): void => {
    if (deleteTarget === undefined || deleting) return
    setDeleting(true)
    setDeleteFailure(undefined)
    void controller.deleteEntry(deleteTarget.type, deleteTarget.id)
      .then(() => { setDeleteTarget(undefined) })
      .catch((error) => { setDeleteFailure(messageOf(error)) })
      .finally(() => { setDeleting(false) })
  }

  const toggleInject = (): void => {
    if (toggling || overview === null) return
    setToggling(true)
    setToggleError(undefined)
    void controller.setInjectContext(!overview.injectContext)
      .catch((error) => { setToggleError(messageOf(error)) })
      .finally(() => { setToggling(false) })
  }

  const detailEntry = detailTarget === undefined
    ? undefined
    : state.entries.find(entry => entry.type === detailTarget.type && entry.id === detailTarget.id)

  return (
    <div className={css.section}>
      <h2 className={css.cardTitle}>{t('title')}</h2>
      <p className={css.configHint}>{t('intro')}</p>

      {/* Status overview */}
      {overview !== null && counts !== undefined && (
        <div className={css.card}>
          <h3 className={css.cardTitle}>{t('statusTitle')}</h3>
          <div className={css.statusGrid}>
            <div className={`${css.statusItem} ${css.statusWide}`}>
              <span className={css.statusLabel}>{t('statusTotal')}</span>
              <span className={css.statusValue}>{overview.memoryCount}</span>
            </div>
            <div className={`${css.statusItem} ${css.statusWide}`}>
              <span className={css.statusLabel}>{t('statusLastWrite')}</span>
              <span className={css.statusValue}>{formatTime(overview.lastWriteAt)}</span>
            </div>
            <div className={css.statusItem}>
              <span className={css.statusLabel}>{t('statusPublic')}</span>
              <span className={css.statusValue}>{counts.public}</span>
            </div>
            <div className={css.statusItem}>
              <span className={css.statusLabel}>{t('statusShortTerm')}</span>
              <span className={css.statusValue}>{counts.shortTerm}</span>
            </div>
            <div className={css.statusItem}>
              <span className={css.statusLabel}>{t('statusPermanent')}</span>
              <span className={css.statusValue}>{counts.permanent}</span>
            </div>
            <div className={css.statusItem}>
              <span className={css.statusLabel}>{t('statusPortable')}</span>
              <span className={css.statusValue}>{counts.portable}</span>
            </div>
            <div className={css.statusItem}>
              <span className={css.statusLabel}>{t('statusEvolution')}</span>
              <span className={css.statusValue}>{counts.evolution}</span>
            </div>
          </div>
        </div>
      )}

      {/* Config toggle */}
      {overview !== null && (
        <div className={css.card}>
          <h3 className={css.cardTitle}>{t('configTitle')}</h3>
          <div className={css.configRow}>
            <div className={css.configInfo}>
              <div className={css.configLabel}>{t('configInject')}</div>
              <div className={css.configHint}>{t('configInjectHint')}</div>
              {toggleError !== undefined && <p className={css.error}>{toggleError}</p>}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={overview.injectContext}
              aria-label={t('configInject')}
              className={`${css.toggle} ${overview.injectContext ? css.on : ''}`}
              disabled={toggling}
              onClick={toggleInject}
            >
              <span className={css.toggleKnob} />
            </button>
          </div>
        </div>
      )}

      {/* Memory management */}
      <div className={css.card}>
        <h3 className={css.cardTitle}>{t('manageTitle')}</h3>
        <p className={css.configHint}>{t('manageHint')}</p>
        <div className={css.filterRow}>
          <button
            type="button"
            className={`${css.filterTab} ${state.filter === undefined ? css.active : ''}`}
            onClick={() => { void controller.setFilter(undefined) }}
          >
            {t('typeAll')}
          </button>
          {MEMORY_TYPES.map(type => (
            <button
              key={type}
              type="button"
              className={`${css.filterTab} ${state.filter === type ? css.active : ''}`}
              onClick={() => { void controller.setFilter(type) }}
            >
              {t(`type${type === 'short_term' ? 'ShortTerm' : type === 'portable_doc' ? 'Portable' : type === 'agent_evolution' ? 'Evolution' : type === 'permanent' ? 'Permanent' : 'Public'}`)}
            </button>
          ))}
        </div>
        {state.entries.length === 0
          ? <div className={css.empty}>{t('empty')}</div>
          : (
            <ul className={css.entryList}>
              {state.entries.map(entry => (
                <li key={`${entry.type}:${entry.id}`} className={css.entryCard}>
                  <div className={css.entryInfo} onClick={() => { setDetailTarget({ type: entry.type, id: entry.id, title: entry.title }) }}>
                    <div className={css.entryTitle}>{entry.title}</div>
                    <div className={css.entrySummary}>{entry.summary}</div>
                    <div className={css.entryMeta}>
                      {formatTime(entry.timestamp)}
                      {entry.mode !== undefined && ` · ${entry.mode === 'daily' ? t('modeDaily') : t('modeWork')}`}
                    </div>
                  </div>
                  <div className={css.entryActions}>
                    <button
                      type="button"
                      className={css.entryActionBtn}
                      onClick={() => { setEditTarget({ type: entry.type, id: entry.id, title: entry.title }) }}
                    >
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      className={`${css.entryActionBtn} ${css.danger}`}
                      onClick={() => { setDeleteTarget({ type: entry.type, id: entry.id, title: entry.title }) }}
                    >
                      {t('delete')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>

      {/* Detail modal */}
      <Modal
        open={detailEntry !== undefined}
        onClose={() => { setDetailTarget(undefined) }}
        title={detailEntry === undefined ? '' : detailEntry.title}
        closeLabel={t('close')}
        className={css.detail as string}
      >
        {detailEntry !== undefined && <DetailBody entry={detailEntry} t={t} />}
      </Modal>

      {/* Edit modal */}
      {editTarget !== undefined && (
        <EditModal
          target={editTarget}
          entry={state.entries.find(entry => entry.type === editTarget.type && entry.id === editTarget.id)}
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

/** Render the raw fields of one memory entry. */
function DetailBody({ entry, t }: { entry: MemoryEntryView; t: (key: keyof typeof en) => string }): ReactNode {
  const data = entry.data
  return (
    <div>
      <div className={css.detailField}>
        <div className={css.detailLabel}>{t('detailId')}</div>
        <div className={css.detailValue}>{entry.id}</div>
      </div>
      {entry.mode !== undefined && (
        <div className={css.detailField}>
          <div className={css.detailLabel}>{t('detailMode')}</div>
          <div className={css.detailValue}>{entry.mode === 'daily' ? t('modeDaily') : t('modeWork')}</div>
        </div>
      )}
      <div className={css.detailField}>
        <div className={css.detailLabel}>{t('detailTime')}</div>
        <div className={css.detailValue}>{formatTime(entry.timestamp)}</div>
      </div>
      {entry.tags !== undefined && entry.tags.length > 0 && (
        <div className={css.detailField}>
          <div className={css.detailLabel}>{t('detailTags')}</div>
          <div>
            {entry.tags.map(tag => <span key={tag} className={css.tagPill}>{tag}</span>)}
          </div>
        </div>
      )}
      <div className={css.detailField}>
        <div className={css.detailLabel}>{t('detailData')}</div>
        <pre className={css.editTextarea}>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  )
}

/** Edit modal: patch writable fields of one memory entry. */
function EditModal({
  target, entry, controller, t, onClose,
}: {
  target: EntryTarget
  entry: MemoryEntryView | undefined
  controller: MemorySettingsStore
  t: (key: keyof typeof en) => string
  onClose: () => void
}): ReactNode {
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | undefined>(undefined)
  const [title, setTitle] = useState(entry?.title ?? target.title)
  const [summary, setSummary] = useState(entry?.summary ?? '')
  const [tags, setTags] = useState((entry?.tags ?? []).join(', '))
  const [extra, setExtra] = useState<Record<string, string>>(() => {
    const data = entry?.data ?? {}
    const result: Record<string, string> = {}
    if (typeof data.summary === 'string') result.summary = data.summary
    if (typeof data.goal === 'string') result.goal = data.goal
    if (typeof data.result === 'string') result.result = data.result
    if (Array.isArray(data.unresolved)) result.unresolved = (data.unresolved as string[]).join(', ')
    if (typeof data.content === 'string') result.content = data.content
    if (typeof data.attributes === 'object' && data.attributes !== null) result.attributes = JSON.stringify(data.attributes, null, 2)
    if (typeof data.preferences === 'object' && data.preferences !== null) result.preferences = JSON.stringify(data.preferences, null, 2)
    if (Array.isArray(data.skills)) result.skills = (data.skills as string[]).join(', ')
    if (Array.isArray(data.relationships)) result.relationships = (data.relationships as string[]).join(', ')
    return result
  })

  const save = (): void => {
    if (saving) return
    setSaving(true)
    setFailure(undefined)
    const patch: Record<string, unknown> = {
      title: title.trim(),
      summary: summary.trim(),
      tags: tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
    }
    if (extra.summary !== undefined) patch.summary = summary.trim()
    if (extra.goal !== undefined) patch.goal = extra.goal.trim()
    if (extra.result !== undefined) patch.result = extra.result.trim()
    if (extra.unresolved !== undefined) patch.unresolved = extra.unresolved.split(',').map(v => v.trim()).filter(v => v.length > 0)
    if (extra.content !== undefined) patch.content = extra.content
    if (extra.attributes !== undefined) {
      try { patch.attributes = JSON.parse(extra.attributes) } catch { setFailure(t('saveFailed')); setSaving(false); return }
    }
    if (extra.preferences !== undefined) {
      try { patch.preferences = JSON.parse(extra.preferences) } catch { setFailure(t('saveFailed')); setSaving(false); return }
    }
    if (extra.skills !== undefined) patch.skills = extra.skills.split(',').map(v => v.trim()).filter(v => v.length > 0)
    if (extra.relationships !== undefined) patch.relationships = extra.relationships.split(',').map(v => v.trim()).filter(v => v.length > 0)
    void controller.updateEntry(target.type, target.id, patch)
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
          <label className={css.editLabel}>{t('editSummaryField')}</label>
          <textarea className={css.editTextarea} value={summary} onChange={e => { setSummary(e.target.value) }} />
        </div>
        <div className={css.editField}>
          <label className={css.editLabel}>{t('editTags')}</label>
          <input className={css.editInput} value={tags} onChange={e => { setTags(e.target.value) }} />
        </div>
        {Object.entries(extra).map(([key, value]) => (
          <div key={key} className={css.editField}>
            <label className={css.editLabel}>{t(key as keyof typeof en)}</label>
            <textarea
              className={css.editTextarea}
              value={value}
              onChange={e => { setExtra(previous => ({ ...previous, [key]: e.target.value })) }}
            />
          </div>
        ))}
        {failure !== undefined && <p className={css.error}>{failure}</p>}
      </div>
    </Modal>
  )
}