# @nesso-how/errors

Shared structured errors for Nesso packages, the host, and repository scripts. The package has no runtime dependencies.

`NessoError` carries `issues: ErrorIssue[]`, where each issue has a `path` and a `message`. The error message joins the issues with newlines and prefixes each nonempty path with `path: `.

`validationIssues` converts validation issue paths into the shared dotted and bracketed notation, with an optional domain prefix. It does not depend on a validation library.

Package-scoped errors extend `NessoError` and keep their own names and domain-specific behavior, so you can handle every scoped error as a `NessoError`. `PluginError` also bounds issues and localized messages before it passes them to the base class.
