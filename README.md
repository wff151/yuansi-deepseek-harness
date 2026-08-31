# DeepSeek Harness (with Memory)

English | [中文](README.zh.md)

> **Fork of DeepSeek Harness**: This repository is a modified fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It keeps all the capabilities of the original framework and adds a *memory system* on top:
> - **`dsh-memory`** — a durable memory plugin providing public memory, short-term working memory, a permanent user profile, portable docs, and agent evolution;
> - **`ui-docs`** — a portable-docs panel to browse and edit each session's documents beside the conversation;
> - **`ui-settings-memory`** — a memory settings page to inspect and manage each memory subsystem.
>
> The original project is developed by [DeepSeek AI](https://deepseek.com) and released under the [MIT](LICENSE) license.

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com). It is built on an architecture where **everything is a plugin**, powered by [Cordis](https://github.com/cordiverse/cordis).

## Highlights

- **Everything is a plugin**: all upstream capabilities are preserved, and extensions are layered on a new memory foundation.
- **Automatic conversation capture**: every user message is automatically recorded into the session's *portable doc*, no tool call required, building a searchable session working memory over time.
- **Multi-level memory**: public memory (long-term, dated and tagged), short-term working memory (weighted, decaying), a permanent user profile (attributes, preferences, skills, relationships), portable docs (per session), and agent evolution (error logs, rules, reflections).
- **Local-model first**: supports local / self-hosted models (OpenAI-compatible endpoints), no cloud dependency, data stays on your machine.
- **One-click start on Windows**: ships `start-web.bat` that detects and stops the process occupying the port before starting the service.

> This project is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES** — use with care in production.

<a id="run"></a>

## Run

### Clone from GitHub

```sh
git clone https://github.com/wff151/yuansi-deepseek-harness.git
cd yuansi-deepseek-harness
pnpm install
pnpm run build
```

`pnpm run build` prepares the repository artifacts; `pnpm dsh web` uses those built artifacts without rebuilding.

### Start the Web UI

```sh
pnpm dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default. For a local launch it also opens the page in the default browser; pass `--no-open` to run the server without opening a browser.

#### One-click start / restart on Windows

On Windows, run `start-web.bat` at the repo root. It finds and stops the process occupying port `3080`, then restarts the service — convenient for day-to-day development.

### Configure a model

This project targets local / self-hosted models (OpenAI-compatible endpoints) by default. In your `dsh` user config, point the model endpoint and API key at your own service (for example `http://127.0.0.1:8080/v1` served by local `llama.cpp`). Model IDs and reasoning settings are all configurable. See the [Web UI guide](docs/user/guide/index.md).

## Memory system

Memory uses the *portable doc* as the session working memory, combined with public memory, a permanent user profile, and agent evolution to form a multi-level, searchable memory system:

- **Portable docs**: one per session, automatically recording each user interaction; browse and edit them in the **portable docs** panel beside the chat.
- **Public memory**: long-term memory, dated and tagged, searchable across sessions.
- **Short-term memory**: weighted, decaying working memory for recent context.
- **Permanent user profile**: the user portrait (preferences, skills, relationships), persistent over time.
- **Agent evolution**: runtime records such as error logs, rules, and reflections.

Use the **memory settings page** to inspect subsystem status (total writes, per-subsystem counts, context-injection toggle) and manage entries.

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md). For agents, follow [AGENTS.md](AGENTS.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Acknowledgments

- [DeepSeek AI](https://deepseek.com) — original author of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), on which this project is based.

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).