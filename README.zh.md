# DeepSeek Harness（记忆增强版）

[English](README.md) | 中文

> **基于 DeepSeek Harness 修改**：本仓库是 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的修改分支（fork），在保留原框架全部能力的基础上，集成了一套*记忆系统*：
> - **`dsh-memory`** —— 持久化记忆插件，提供公共记忆、短期工作记忆、永久用户档案、随身文档与进化档案；
> - **`ui-docs`** —— 随身文档面板，在聊天界面旁即可查阅、编辑每个会话的随身文档；
> - **`ui-settings-memory`** —— 记忆设置页，集中查看与管理各记忆子系统。
>
> 原项目由 [DeepSeek AI](https://deepseek.com) 开发，采用 [MIT](LICENSE) 许可证。

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。它构建于**一切皆插件**的架构之上，由 [Cordis](https://github.com/cordiverse/cordis) 驱动。

## 特性一览

- **一切皆插件**：保留上游框架的全部能力，扩展功能以一个全新的记忆构建为基础。
- **对话自动沉淀**：每次用户消息都会自动记录进对应会话的*随身文档*，无需模型主动调用工具，长期积累可检索的会话工作记忆。
- **多级记忆体系**：公共记忆（长期、按日期与标签组织）、短期工作记忆（带权重与衰减）、永久用户档案（画像、偏好、技能、关系）、随身文档（按会话）、进化档案（错误日志、规则、反思）。
- **本地模型优先**：支持接入本地 / 自建模型（OpenAI 兼容端点），不依赖云端，数据留在本机。
- **Windows 一键启动**：提供 `start-web.bat`，自动检测并停止占用端口的旧进程后启动服务。

> 本项目当前处于 _开发者预览_ 阶段，正在快速迭代，**未来将出现破坏兼容性的变更**，请谨慎用于生产。

<a id="run"></a>

## 运行

### 从 GitHub 拉取源码

```sh
git clone https://github.com/wff151/yuansi-deepseek-harness.git
cd yuansi-deepseek-harness
pnpm install
pnpm run build
```

`pnpm run build` 会准备仓库产物；`pnpm dsh web` 会直接使用这些已构建产物，不会重新构建。

### 启动 Web UI

```sh
pnpm dsh web
```

默认在 `http://127.0.0.1:3080` 启动 Web UI。本机启动时还会用默认浏览器打开页面。传入 `--no-open` 可仅运行服务器而不打开浏览器。

#### Windows 一键启动 / 重启

在 Windows 上，可以直接运行仓库根目录的 `start-web.bat`。它会自动查找并停止占用 `3080` 端口的进程，然后重新启动服务，适合日常开发调试。

### 配置模型

本项目默认接入本地 / 自建模型（OpenAI 兼容端点）。请在 `dsh` 的用户配置中把模型端点和 Api Key 指向你自己的服务（例如通过本地 `llama.cpp` 启动的 `http://127.0.0.1:8080/v1`）——引用的模型、推理推理档位等均可在配置中调整，具体见 [Web UI 指南](docs/user/guide/index.zh.md)。

## 记忆系统

记忆以 *随身文档* 为会话工作记忆，配合公共记忆、永久用户档案与进化档案，构成多级、可检索的记忆体系：

- **随身文档（portable）**：每个会话一份，自动记录每次用户交互，可在聊天界面旁的 **随身文档** 面板中浏览与编辑。
- **公共记忆（public）**：长期记忆，按日期与标签组织，可跨会话检索。
- **短期记忆（short）**：带权重与衰减的工作记忆，用于最近的上下文。
- **永久用户档案（permanent）**：用户画像（偏好、技能、关系等），长期持久。
- **进化档案（agent_evolution）**：错误日志、规则、反射等 agent 运行时演进记录。

你可以在 **记忆设置页** 中查看各子系统状态（写入总数、各子系统计数、上下文注入开关）并管理条目。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 参与贡献

参见 [CONTRIBUTING.zh.md](CONTRIBUTING.zh.md)。

## 致谢

- [DeepSeek AI](https://deepseek.com) —— 本项目所基于的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的原作者。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。