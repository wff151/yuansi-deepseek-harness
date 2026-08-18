# DeepSeek Harness

English | [中文](README.zh.md)

> **Fork of DeepSeek Harness**: This repository is a modified fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It keeps all the capabilities of the original framework and adds a memory system on top: a durable memory plugin (`dsh-memory`), a portable-docs panel (`ui-docs`) for browsing and editing documents beside the conversation, and a memory settings page (`ui-settings-memory`). The original project is developed by [DeepSeek AI](https://deepseek.com) and released under the [MIT](LICENSE) license.

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It uses an architecture where **everything is a plugin**, and is powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://github.com/cordiverse/paper).

## Developer preview

DeepSeek Harness is currently in _developer preview_ and is iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI, served at `http://127.0.0.1:3080` by default. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

## Community and support

- Feel free to submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## Acknowledgments

- [DeepSeek AI](https://deepseek.com) — original author of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), on which this project is based.

## Contributors

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) by [DeepSeek AI](https://deepseek.com) — the upstream project and its original contributors, on which this fork is based.

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
