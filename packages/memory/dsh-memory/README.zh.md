# @deepseek-ai/dsh-memory

面向模型（Model-facing）的记忆系统，用于 DeepSeek Harness：持久化长期公共记忆、
带权重的短期工作记忆、永久用户画像、随会话携带的工作文档，以及 Agent 进化档案。

## 子系统

### 公共记忆（`public`）
长期、带日期与标签的记忆，按模式（`daily` 日常 / `work` 工作）组织。每条记录
包含标题、摘要、结构化标签、目标、未解决的问题和结果。模型通过 `memory_record`
工具写入。

### 短期记忆（`short`）
带权重的、可衰减的上下文项。重复内容会提升权重。模型通过 `memory_write_short`
写入。衰减与压缩由 spill 子系统管理。

### 永久记忆（`permanent`）
用户画像：属性、偏好、技能和关系。模型通过 `memory_set_profile` 写入，支持
点路径（如 `preferences.favorite-language`）。实体字段（skills、relationships、
preferences）为追加模式；标量字段为覆盖模式。

### 随身文档（`portable`）
随会话携带的工作记忆，在同一会话的各轮对话之间持续存在。记录已解决/未解决的
问题、当前目标和交换日志。通过 `memory_portable_doc` 工具更新。

### Agent 进化档案（`evolution`）
Agent 自身成长的记录：错题日志、改进提案、影子测试、规则和反思日记。通过
`memory_evolution` 工具写入。

## 检索

系统实现了三重检索流水线：

1. **时间过滤** — 从查询中解析相对/绝对时间意图
2. **标签匹配** — 精确的结构化标签交集
3. **语义搜索** — 关键词评分，辅以中文二元组（bigram）回退

融合排序公式：精确标签 + 显式时间 > 精确标签 + 模糊时间 > 高语义 + 时间权重 >
纯语义。

## API

### 服务
`ctx.memory` — `MemoryFacility` 实例。`store` 属性提供底层的 `MemoryStore`，
用于直接访问。

### 模型工具
- `memory_record` — 记录一条长期公共记忆
- `memory_search` — 三重检索搜索公共记忆和短期记忆
- `memory_write_short` — 写入一条带权重的短期记忆
- `memory_set_profile` — 更新永久用户画像
- `memory_portable_doc` — 更新当前会话的随身工作文档
- `memory_evolution` — 追加 Agent 进化档案记录
- `memory_status` — 查看记忆子系统统计

### 提示上下文
当 `injectContext` 启用时（默认开启），记忆快照（随身文档 + 永久画像）会作为
动态提示上下文注入到每一步的模型请求中。

## 配置

```yaml
- id: memory
  name: '@deepseek-ai/dsh-memory'
  config:
    injectContext: true   # 将记忆快照注入为提示上下文
```

## 存储

记忆域名为 `dsh-memory`（版本 1），包含五个表：`public`、`short`、`permanent`、
`portable`、`evolution`。后端路由通过部署的 `storage-domain` 配置指定。