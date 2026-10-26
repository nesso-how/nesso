# @nesso-how/errors

Shared structured errors for Nesso packages, the host, and repository scripts, with no runtime dependencies.

`NessoError` carries `issues: ErrorIssue[]`, where each issue has a `path` and `message`. Its message joins issues with newlines, prefixing nonempty paths with `path: `.

Package-scoped errors extend `NessoError` to retain their names and domain-specific behavior. `PluginError` also bounds issues and localized messages before passing them to the base class. All scoped errors can be handled as `NessoError`.
