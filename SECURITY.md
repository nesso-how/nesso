# Reporting a vulnerability

Email **[nesso-how@proton.me](mailto:nesso-how@proton.me)**, the contact listed on the [Nesso organization profile](https://github.com/nesso-how), to report a suspected vulnerability privately. Keep security details out of public issues and Discussions while maintainers investigate.

Include the Nesso version, operating system, whether you used desktop or web, what happened, and the impact you observed. If a plugin or MCP client was involved, include its name and version. On desktop, attach `main.log` from **Help → Open Logs Folder**, and `main.old.log` if the problem happened a while ago. Logs hold error messages and stack traces, not your graph, but they can include file paths, so review them before sending. Use sample data and leave out API keys, MCP tokens, and personal graph contents.

## Security boundaries

- **Plugins:** Installing a plugin on desktop approves one specific package and the access it declares. Its action code runs in an isolated worker or panel, and the host checks each request before allowing a graph edit or access to capabilities such as files or private storage. Themes and vocabularies are validated as data and never run code.
- **External assistants:** The desktop MCP server listens locally and requires its bearer token. Connected clients can read graph data, but document writes and local plugin proposals each need a separate approval in Nesso.
- **AI connections:** The desktop app stores provider credentials encrypted on the device and leaves them out of app backups. Chat requests go straight to the endpoint you selected.

See the [architecture](docs/architecture.md#follow-an-edit) for how a request reaches the store and the [plugin SDK](packages/plugin/README.md) for the supported APIs.
