/**
 * Triple retrieval: time filter → tag match → semantic search → fused ranking.
 *
 * First pass: time filter (outermost) — parse time intent from the query.
 * Second pass: tag match (exact strike) — match query entities/intent against
 * structured tags. Third pass: semantic search (fuzzy coverage) — keyword
 * scoring with Chinese bigrams as the fallback.
 *
 * Fused ranking: exact tag + explicit time > exact tag + fuzzy time >
 * high semantic + time weight > pure semantic.
 * @module @deepseek-ai/dsh-memory/src/retrieval
 */

import type { MemoryMode } from './types.ts'
import type { MemoryStore } from './store.ts'
import type { PublicMemoryRecord, ShortTermItemRecord } from './domain.ts'

// ─── time filter ─────────────────────────────────────────────────────────

interface TimeIntent {
  type: string
  value: { year?: number; month?: number; rel?: string }
}

const TIME_PATTERNS: { re: RegExp; type: string; get: (m: RegExpMatchArray) => { year?: number; month?: number; rel?: string } }[] = [
  { re: /(20\d{2})年?[-年](\d{1,2})月?/, type: 'year-month', get: m => ({ year: +m[1]!, month: +m[2]! }) },
  { re: /(20\d{2})年/, type: 'year', get: m => ({ year: +m[1]! }) },
  { re: /(昨天|今天|前天)/, type: 'relative', get: m => ({ rel: m[1]! }) },
  { re: /(上个月|这个月|上上个月)/, type: 'month-rel', get: m => ({ rel: m[1]! }) },
  { re: /(去年|今年|前年)/, type: 'year-rel', get: m => ({ rel: m[1]! }) },
  { re: /(上周|这周|上上周)/, type: 'week-rel', get: m => ({ rel: m[1]! }) },
]

function parseTimeIntent(query: string): TimeIntent | null {
  for (const p of TIME_PATTERNS) {
    const m = query.match(p.re)
    if (m) return { type: p.type, value: p.get(m) }
  }
  return null
}

function matchTime(entry: PublicMemoryRecord, intent: TimeIntent | null): number {
  if (!intent) return 0
  const [y, mo] = entry.date.split('-').map(Number)
  const now = new Date()
  const ny = now.getFullYear()
  const nm = now.getMonth() + 1
  const nd = now.getDate()

  switch (intent.type) {
    case 'year-month':
      return y === intent.value.year && mo === intent.value.month ? 1 : 0
    case 'year':
      return y === intent.value.year ? 1 : 0
    case 'relative': {
      const target = {
        '今天': `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`,
        '昨天': new Date(now.getTime() - 86400000).toISOString().slice(0, 10),
        '前天': new Date(now.getTime() - 2 * 86400000).toISOString().slice(0, 10),
      }[intent.value.rel ?? '']
      return entry.date === target ? 1 : 0
    }
    case 'month-rel': {
      let targetMonth = nm
      if (intent.value.rel === '上个月') targetMonth = nm - 1
      if (intent.value.rel === '上上个月') targetMonth = nm - 2
      if (targetMonth < 1) targetMonth += 12
      return y === ny && mo === targetMonth ? 1 : 0
    }
    case 'year-rel': {
      const targetYear = { '今年': ny, '去年': ny - 1, '前年': ny - 2 }[intent.value.rel ?? '']
      return y === targetYear ? 1 : 0
    }
    case 'week-rel': {
      const day = 86400000
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const dow = (today.getDay() + 6) % 7 // Monday = 0
      const thisMonday = today.getTime() - dow * day
      const offsets: Record<string, number> = { '这周': 0, '上周': 7, '上上周': 14 }
      const start = thisMonday - (offsets[intent.value.rel ?? ''] ?? 0) * day
      const end = start + 7 * day
      const t = new Date(entry.date).getTime()
      return t >= start && t < end ? 1 : 0
    }
    default:
      return 0
  }
}

// ─── tag match ───────────────────────────────────────────────────────────

function collectKnownTags(entries: PublicMemoryRecord[]): string[] {
  const set = new Set<string>()
  for (const e of entries) {
    for (const t of e.tags ?? []) set.add(t)
  }
  return [...set]
}

function extractTags(query: string, knownTags: string[]): string[] {
  return knownTags.filter(tag => query.includes(tag))
}

function tagScore(entry: PublicMemoryRecord, queryTags: string[]): number {
  if (queryTags.length === 0) return 0
  const entryTags = new Set(entry.tags ?? [])
  const hit = queryTags.filter(t => entryTags.has(t))
  if (hit.length === 0) return 0
  return hit.length / queryTags.length
}

// ─── semantic search (keywords + Chinese bigrams) ────────────────────────

/**
 * Tokenize: English words, then Chinese runs as whole segments (≤4 chars)
 * plus bigrams. Bigrams lift fuzzy Chinese matching ("看深度的相机" → "相机").
 */
function tokenize(text: string): string[] {
  const str = String(text ?? '').toLowerCase()
  const tokens = new Set<string>()
  for (const w of str.match(/[a-z][a-z0-9_]{1,}/g) ?? []) {
    tokens.add(w)
  }
  const cnRuns = str.match(/[\u4e00-\u9fa5]+/g) ?? []
  for (const run of cnRuns) {
    if (run.length <= 4) tokens.add(run)
    for (let i = 0; i < run.length - 1; i++) {
      tokens.add(run.slice(i, i + 2))
    }
  }
  return [...tokens]
}

function semanticScore(entry: PublicMemoryRecord, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0
  const haystack = [
    entry.title,
    entry.summary,
    entry.goal,
    entry.result,
    (entry.unresolved ?? []).join(' '),
  ].join(' ').toLowerCase()
  let hits = 0
  for (const tok of queryTokens) {
    if (haystack.includes(tok)) hits++
  }
  return hits / queryTokens.length
}

// ─── fused ranking ───────────────────────────────────────────────────────

export interface ScoredResult<T> {
  item: T
  scores: { time: number; tag: number; semantic: number }
  score: number
}

/** Search public memories across one or both modes. */
export function searchPublicMemory(
  store: MemoryStore,
  query: string,
  options: { mode?: MemoryMode | 'both'; topK?: number } = {},
): { results: ScoredResult<PublicMemoryRecord>[]; timeIntent: TimeIntent | null; queryTags: string[] } {
  const mode = options.mode ?? 'both'
  const topK = options.topK ?? 5
  const entries = mode === 'both'
    ? store.listAllPublicMemories()
    : store.listPublicMemories(mode)

  const timeIntent = parseTimeIntent(query)
  const knownTags = collectKnownTags(entries)
  const queryTags = extractTags(query, knownTags)
  const queryTokens = tokenize(query)

  const scored = entries.map(entry => {
    const t = matchTime(entry, timeIntent)
    const tag = tagScore(entry, queryTags)
    const sem = semanticScore(entry, queryTokens)
    let score = 0
    if (tag > 0 && t > 0) score = 1.0 * tag + 0.8 * t + 0.3 * sem
    else if (tag > 0) score = 0.8 * tag + 0.4 * sem
    else if (sem > 0 && t > 0) score = 0.6 * sem + 0.5 * t
    else score = 0.5 * sem
    return { item: entry, scores: { time: t, tag, semantic: sem }, score }
  })

  const results = scored
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
  return { results, timeIntent, queryTags }
}

/** Search short-term memory by weight order plus keyword filtering. */
export function searchShortTerm(
  store: MemoryStore,
  mode: MemoryMode,
  query: string,
  topK = 5,
): ScoredResult<ShortTermItemRecord>[] {
  const items = store.listShortTerm(mode)
  const tokens = tokenize(query)
  return items
    .map(item => {
      const sem = semanticScore({ title: item.content, summary: item.content } as PublicMemoryRecord, tokens)
      return { item, scores: { time: 0, tag: 0, semantic: sem }, score: item.weight * (0.5 + sem) }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

/** Compose the retrieved memory context text injected before each step. */
export function renderRetrievedContext(
  store: MemoryStore,
  query: string,
  options: { mode?: MemoryMode | 'both'; topK?: number } = {},
): string {
  const mode = options.mode ?? 'both'
  const pub = searchPublicMemory(store, query, { ...options, mode })
  const short = mode === 'both'
    ? [...searchShortTerm(store, 'daily', query), ...searchShortTerm(store, 'work', query)]
    : searchShortTerm(store, mode, query)

  const lines = ['[记忆检索] 在回答用户问题前，你可以参考以下从记忆中检索到的相关信息：']
  for (const r of pub.results) {
    const e = r.item
    lines.push(`[${e.date} - ${e.title}]（${e.mode === 'work' ? '工作' : '日常'}）`)
    lines.push(`  摘要：${e.summary}`)
    if (e.unresolved?.length) lines.push(`  未解决：${e.unresolved.join('；')}`)
    if (e.result) lines.push(`  结果：${e.result}`)
  }
  for (const r of short) {
    lines.push(`[短期记忆] ${r.item.content}`)
  }
  if (pub.results.length === 0 && short.length === 0) {
    lines.push('（未检索到相关记忆）')
  }
  return lines.join('\n')
}