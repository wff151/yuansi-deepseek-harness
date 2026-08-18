/**
 * memory domain zod schemas (names derived from map keys:
 * memoryStatusRequestSchema / memoryStatusValueSchema / memoryList* /
 * memoryGet* / memoryDelete* / memoryUpdate* / memoryConfig*).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import type { MemoryEntryView } from './memory.ts'

/** memory.status request payload. */
export const memoryStatusRequestSchema = z.object({}) satisfies z.ZodType<Wire<RequestPayload<'memory.status'>>>

/** memory.status response value. */
export const memoryStatusValueSchema = z.object({
  memoryCount: z.number(),
  lastWriteAt: z.string().optional(),
  injectContext: z.boolean(),
  counts: z.object({
    public: z.number(),
    shortTerm: z.number(),
    permanent: z.number(),
    portable: z.number(),
    evolution: z.number(),
  }),
}) satisfies z.ZodType<Wire<ResponseValue<'memory.status'>>>

/** One memory entry row of memory.list / memory.get / memory.update. */
export const memoryEntryViewSchema = z.object({
  type: z.union([
    z.literal('public'),
    z.literal('short_term'),
    z.literal('permanent'),
    z.literal('portable_doc'),
    z.literal('agent_evolution'),
  ]),
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  timestamp: z.string(),
  tags: z.array(z.string()).optional(),
  mode: z.union([z.literal('daily'), z.literal('work')]).optional(),
  data: z.record(z.string(), z.unknown()),
}) satisfies z.ZodType<Wire<MemoryEntryView>>

/** memory.list request payload. */
export const memoryListRequestSchema = z.object({
  type: z.string().optional(),
  mode: z.string().optional(),
  limit: z.number().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'memory.list'>>>

/** memory.list response value. */
export const memoryListValueSchema = z.object({
  entries: z.array(memoryEntryViewSchema),
}) satisfies z.ZodType<Wire<ResponseValue<'memory.list'>>>

/** memory.get request payload. */
export const memoryGetRequestSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'memory.get'>>>

/** memory.get response value. */
export const memoryGetValueSchema = memoryEntryViewSchema satisfies z.ZodType<Wire<ResponseValue<'memory.get'>>>

/** memory.delete request payload. */
export const memoryDeleteRequestSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
}) satisfies z.ZodType<Wire<RequestPayload<'memory.delete'>>>

/** memory.delete response value. */
export const memoryDeleteValueSchema = z.object({
  deleted: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'memory.delete'>>>

/** memory.update request payload. */
export const memoryUpdateRequestSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  patch: z.record(z.string(), z.unknown()),
}) satisfies z.ZodType<Wire<RequestPayload<'memory.update'>>>

/** memory.update response value. */
export const memoryUpdateValueSchema = memoryEntryViewSchema satisfies z.ZodType<Wire<ResponseValue<'memory.update'>>>

/** memory.config request payload. */
export const memoryConfigRequestSchema = z.object({
  injectContext: z.boolean().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'memory.config'>>>

/** memory.config response value. */
export const memoryConfigValueSchema = z.object({
  injectContext: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'memory.config'>>>

/** Status view type re-export for schema consumers. */
export type { MemoryStatusView } from './memory.ts'
