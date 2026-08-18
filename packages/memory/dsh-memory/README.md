# @deepseek-ai/dsh-memory

Model-facing memory system for the DeepSeek Harness: durable long-term public
memories, weighted short-term working memory, permanent user profile, portable
per-session working documents, and agent evolution records.

## Subsystems

### Public Memory (`public`)
Long-term, dated, tagged memories organized by mode (`daily` / `work`). Each
entry stores a title, summary, structured tags, goal, unresolved problems, and
result. Entries are written explicitly by the model through `memory_record`.

### Short-Term Memory (`short`)
Weighted, decaying context items. Repeated content boosts its weight. The
model writes through `memory_write_short`. Decay and compaction are managed
by the spill subsystem.

### Permanent Profile (`permanent`)
The user portrait: attributes, preferences, skills, and relationships. The
model writes through `memory_set_profile` with dot-path support (e.g.,
`preferences.favorite-language`). Entity fields (skills, relationships,
preferences) are append-only; scalar fields are overwrite.

### Portable Docs (`portable`)
Per-session working memory that follows the model across turns within one
session. Records solved/unresolved problems, the current goal, and the
exchange log. Updated through `memory_portable_doc`.

### Agent Evolution (`evolution`)
Records of the agent's own growth: error logs, proposals, shadow tests, rules,
and reflections. Written through `memory_evolution`.

## Retrieval

The package implements a triple-retrieval pipeline:

1. **Time filter** — parse relative/absolute time intent from the query
2. **Tag match** — exact structured tag intersection
3. **Semantic search** — keyword scoring with Chinese bigram fallback

Results are fused-ranked with a weighted formula: exact tag + explicit time >
exact tag + fuzzy time > high semantic + time weight > pure semantic.

## API

### Service
`ctx.memory` — `MemoryFacility` instance. The `store` property provides the
underlying `MemoryStore` for direct access.

### Model-facing tools
- `memory_record` — record a long-term public memory
- `memory_search` — triple-retrieval search across public and short-term memory
- `memory_write_short` — write a weighted short-term item
- `memory_set_profile` — update the permanent user profile
- `memory_portable_doc` — update the current session's portable working doc
- `memory_evolution` — append an agent evolution record
- `memory_status` — view memory subsystem statistics

### Prompt context
When `injectContext` is enabled (default), the memory snapshot (portable doc +
permanent profile) is injected as a dynamic prompt context before each step.

## Configuration

```yaml
- id: memory
  name: '@deepseek-ai/dsh-memory'
  config:
    injectContext: true   # inject memory snapshot as prompt context
```

## Storage

The memory domain is named `dsh-memory` (version 1) with five tables:
`public`, `short`, `permanent`, `portable`, `evolution`. The backend is
routed through the deployment's `storage-domain` configuration.