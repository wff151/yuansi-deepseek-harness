/**
 * Model-facing memory tools: record, search, and evolve the agent's memory
 * across every subsystem. All tools are read-mostly and cooperative; writes
 * go through the durable memory store.
 * @module @deepseek-ai/dsh-memory/src/tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { MemoryStore } from './store.ts'
import { renderRetrievedContext } from './retrieval.ts'
import type { MemoryMode, RecordId } from './types.ts'

const TEXT_OUTPUT = {
  schema: { type: 'string' as const },
  render: (_args: unknown, value: string) => [{ type: 'text' as const, text: value }],
}

const MODE_PARAM = {
  type: 'string' as const,
  enum: ['daily', 'work'] as const,
  description: '记忆模式：daily（日常）/ work（工作）。',
}

function modeOf(value: unknown): MemoryMode {
  return value === 'work' ? 'work' : 'daily'
}

/** Register every memory tool on `ctx.tools`. */
export function registerMemoryTools(ctx: Context, store: MemoryStore): void {
  ctx.tools.register(defineTool({
    name: 'memory_record',
    description:
      '记录一条长期公共记忆。用于把一次有结论的任务、对话或事件沉淀为可检索的长期记忆，'
      + '包含标题、摘要、结构化标签、目标、未解决问题与结果。',
    parameters: {
      mode: { ...MODE_PARAM, required: true },
      title: { type: 'string', required: true, description: '简练任务名（用作记忆标题）。' },
      summary: { type: 'string', required: true, description: '三四百字以内的摘要。' },
      tags: { type: 'array', items: { type: 'string' }, description: '结构化标签，便于检索。' },
      goal: { type: 'string', description: '本次任务的目标。' },
      unresolved: { type: 'array', items: { type: 'string' }, description: '未解决的问题列表。' },
      result: { type: 'string', description: '最终结果。' },
    },
    output: TEXT_OUTPUT,
    execute: async (args, _exec) => {
      const entry = await store.recordPublicMemory({
        mode: modeOf(args.mode),
        title: args.title,
        summary: args.summary,
        tags: args.tags ?? [],
        goal: args.goal,
        unresolved: args.unresolved ?? [],
        result: args.result,
      })
      return `已记录公共记忆 ${entry.memory_id}（${entry.mode}）\n标题：${entry.title}\n日期：${entry.date}`
    },
    presentCall: args => ({ card: 'generic', title: '记录公共记忆', kind: 'other', rawInput: args.title }),
  }))

  ctx.tools.register(defineTool({
    name: 'memory_search',
    description:
      '三重检索记忆库（时间过滤 → 标签匹配 → 语义搜索）。用于回答需要参考过去经验、'
      + '偏好或结论的问题；查询可含时间词（如"上周""2026年"）或标签关键词。',
    parameters: {
      query: { type: 'string', required: true, description: '检索问题或关键词。' },
      mode: { ...MODE_PARAM, description: '限定检索模式；省略则跨 daily 与 work 检索。' },
      top_k: { type: 'integer', description: '返回条数上限，默认 5。' },
    },
    output: TEXT_OUTPUT,
    execute: async (args, _exec) => {
      const mode = args.mode === undefined ? 'both' : modeOf(args.mode)
      return renderRetrievedContext(store, args.query, { mode, topK: args.top_k ?? 5 })
    },
    presentCall: args => ({ card: 'generic', title: '检索记忆', kind: 'other', rawInput: args.query }),
  }))

  ctx.tools.register(defineTool({
    name: 'memory_write_short',
    description:
      '写入一条短期记忆（带权重的动态上下文窗口）。用于记住当前会话中需要短期保留的'
      + '事实、偏好或临时结论；重复内容会提升权重。',
    parameters: {
      mode: { ...MODE_PARAM, required: true },
      content: { type: 'string', required: true, description: '短期记忆内容。' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签。' },
      weight: { type: 'number', description: '初始权重，默认 1。' },
    },
    output: TEXT_OUTPUT,
    execute: async (args, _exec) => {
      const item = await store.writeShortTerm(modeOf(args.mode), args.content, args.tags ?? [], args.weight ?? 1)
      return `已写入短期记忆（${item.mode}，权重 ${item.weight.toFixed(2)}）\n${item.content}`
    },
    presentCall: args => ({ card: 'generic', title: '写入短期记忆', kind: 'other', rawInput: args.content }),
  }))

  ctx.tools.register(defineTool({
    name: 'memory_set_profile',
    description:
      '更新永久记忆（用户画像）。支持点路径，如 "preferences.喜欢"；skills / relationships / '
      + 'preferences 为追加型实体字段，其余为覆盖型标量字段。',
    parameters: {
      mode: { ...MODE_PARAM, required: true },
      path: { type: 'string', required: true, description: '字段路径，如 "attributes.职业" 或 "preferences.喜欢"。' },
      value: { type: 'json', description: '字段值；数组或实体字段会追加。' },
    },
    output: TEXT_OUTPUT,
    execute: async (args, _exec) => {
      const profile = await store.setPermanent(modeOf(args.mode), args.path, args.value ?? true)
      return `已更新永久记忆 ${args.mode}.${args.path}\n`
        + `属性：${Object.keys(profile.attributes).length} | 喜好：${Object.keys(profile.preferences).length} `
        + `| 技能：${profile.skills.length} | 关系：${profile.relationships.length}`
    },
    presentCall: args => ({ card: 'generic', title: '更新永久记忆', kind: 'other', rawInput: `${args.mode}.${args.path}` }),
  }))

  ctx.tools.register(defineTool({
    name: 'memory_portable_doc',
    description:
      '更新当前会话的随身文档（工作记忆）。记录已解决 / 未解决问题与当前目标，'
      + '随每次输入注入模型，避免跨多轮对话忘记目的。',
    parameters: {
      solved: { type: 'array', items: { type: 'string' }, description: '本次解决的问题列表。' },
      unresolved: { type: 'array', items: { type: 'string' }, description: '本次发现的未解决问题列表。' },
      refined_goal: { type: 'string', description: '更新后的当前目标。' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签。' },
    },
    output: TEXT_OUTPUT,
    execute: async (args, exec) => {
      if (!exec.agent) throw new Error('memory_portable_doc requires an owning agent session')
      const doc = await store.recordExchange(exec.agent.session.id, '', {
        solved: args.solved ?? [],
        unresolved: args.unresolved ?? [],
        refinedGoal: args.refined_goal,
        tags: args.tags ?? [],
      })
      return `随身文档已更新（第 ${doc.exchangeCount} 次交换）\n`
        + `目标：${doc.goal || '无明确目标'}\n`
        + `已解决：${doc.solvedProblems.join('、') || '无'}\n`
        + `未解决：${doc.unresolvedProblems.join('、') || '无'}`
    },
    presentCall: () => ({ card: 'generic', title: '更新随身文档', kind: 'other', rawInput: 'portable doc' }),
  }))

  ctx.tools.register(defineTool({
    name: 'memory_evolution',
    description:
      '追加一条 Agent 进化档案记录（错题日志 / 进化提案 / 影子测试 / 规则 / 反思日记）。'
      + '用于沉淀失败经验、发布规则与自我反思。',
    parameters: {
      type: {
        type: 'string',
        required: true,
        enum: ['error-log', 'proposal', 'shadow-test', 'rule', 'reflection'],
        description: '记录类型：error-log 错题 / proposal 提案 / shadow-test 影子测试 / rule 规则 / reflection 反思。',
      },
      content: { type: 'json', required: true, description: '记录内容对象，如 { task, fingerprint, detail } 或 { ruleId, content }。' },
    },
    output: TEXT_OUTPUT,
    execute: async (args, _exec) => {
      const record = await store.appendEvolution({
        type: args.type,
        id: `EVO_${Date.now().toString(36)}` as RecordId,
        timestamp: new Date().toISOString(),
        ...(args.content as Record<string, unknown>),
      })
      return `已记录进化档案 ${record.id}（${record.type}）`
    },
    presentCall: args => ({ card: 'generic', title: '记录进化档案', kind: 'other', rawInput: args.type }),
  }))

  ctx.tools.register(defineTool({
    name: 'memory_status',
    description: '查看记忆系统状态：各记忆区（公共 / 短期 / 永久 / 随身文档 / 进化档案）的统计。',
    parameters: {},
    output: TEXT_OUTPUT,
    execute: async (_args, _exec) => {
      const lines = ['=== 记忆系统状态 ===']
      for (const mode of ['daily', 'work'] as const) {
        const pub = store.listPublicMemories(mode)
        const short = store.listShortTerm(mode)
        const perm = store.getPermanent(mode)
        lines.push(`\n[${mode === 'daily' ? '日常' : '工作'}]`)
        lines.push(`  公共记忆：${pub.length} 条`)
        lines.push(`  短期记忆：${short.length} 条`)
        lines.push(`  永久记忆：${Object.keys(perm.attributes).length} 属性 / ${Object.keys(perm.preferences).length} 喜好 / ${perm.skills.length} 技能 / ${perm.relationships.length} 关系`)
      }
      lines.push(`\n[随身文档] ${store.listPortableDocs().length} 份`)
      lines.push(`[进化档案] ${store.listAllEvolution().length} 条`)
      lines.push(`[写入总数] ${store.memoryCount} 次`)
      return lines.join('\n')
    },
    presentCall: () => ({ card: 'generic', title: '查看记忆状态', kind: 'other', rawInput: 'status' }),
  }))
}