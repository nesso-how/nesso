# Compatibility and migrations

Nesso's data formats don't all change with each app release, so their versions are separate from the app version and the plugin API. Support for older data works in one direction only, which means an older app might not read newer data or run newer plugins.

## Data

New releases keep the migration steps they need to read valid data in supported older formats, and startup and backup restoration use the same steps for the app's persisted records. If a record has an unknown version or is malformed, Nesso reports it instead of silently overwriting it.

When startup upgrades a persisted record, it first saves a backup of the originals and then writes the new version. If that backup fails, the upgrade is not saved. Reading or converting a file in memory needs no backup because it leaves the source unchanged.

Migrations preserve saved information and its meaning. The only exception is older data removed by a documented retention policy, as in [Review's progress records](../plugins/review/README.md#api).

Plugins own their private data formats and migrations. When the host migrates storage records, it keeps plugin payloads intact without interpreting their fields or upgrading the plugin's code.

## Plugin API

Nesso supports only the current plugin API version. It has no adapters or feature negotiation, and superseded API versions have no promised support period. If a plugin targets an unsupported version, Nesso doesn't load it but keeps its installed record and private data.

An `apiVersion` describes the complete contract, including behavior and permissions, and a plugin that is compatible with that version stays compatible as the app changes. Any change that requires a newer host therefore gets a new API version, even if it only adds a method. Release notes explain incompatible changes and any plugin updates they require. An API update does not grant extra permissions or migrate private plugin data.

## Downgrades and backups

Neither the app nor plugins convert newer data back to an older format automatically, so returning to an older version requires the originals or a backup from before the upgrade that the older version can read. That snapshot leaves out any changes made after it was saved. For plugins, a matching `apiVersion` does not guarantee that an older plugin can read private data written by a newer one.

An app backup contains the document and its workspace, preferences, conversation, and private plugin data, but it leaves out provider credentials and installed plugin packages. Restoring a backup therefore brings back saved data without restoring the whole installation or earlier plugin code.

AI connections, installed packages, and data-location configuration are device-local records. Before upgrading one of them, Nesso saves a copy of the original in the desktop profile, and these copies aren't part of app backups or data-folder transfers. See the [data folder layout](architecture.md#from-memory-to-disk) and the format index below.

## Data formats

A format gets its own version when its meaning must be preserved and it can outlive the code that wrote it or pass between components that update independently. That version changes whenever the format's structure or meaning requires an explicit conversion. Structures that always change together can share a version, while disposable state such as window geometry can stay unversioned if falling back to defaults is an acceptable recovery.

Each module validates and converts the formats it uses, and the table below links to that code. "No migrations yet" means the format is versioned but has no conversion steps. "Not versioned" means the format has no version field.

| Format or contract                                        | Current schema                                                                                                          | Migrations                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| JSON-LD profile (export, import, clipboard, stored graph) | [Profile](../packages/schema/README.md#json-ld-profile) and [parser](../packages/schema/src/jsonld.ts)                  | [Schema migrations](../packages/schema/src/migrations.ts)                              |
| Document record                                           | [Envelope](../src/store/migrations.ts), [graph](../packages/schema/src/types.ts), [workspace](../src/store/settings.ts) | [Store migrations](../src/store/migrations.ts)                                         |
| Preferences record                                        | [Envelope](../src/store/migrations.ts) and [settings](../src/store/settings.ts)                                         | [Store migrations](../src/store/migrations.ts)                                         |
| Conversation record                                       | [Chat schema](../packages/ai/src/chat.ts)                                                                               | [Store migrations](../src/store/migrations.ts)                                         |
| Plugin data envelope                                      | [Storage schema](../src/store/plugin-storage.ts)                                                                        | [Store migrations](../src/store/migrations.ts)                                         |
| Backup envelope                                           | [Backup schema](../shared/backup.ts)                                                                                    | No envelope migrations yet. Records use [store migrations](../src/store/migrations.ts) |
| Plugin API, theme and vocabulary definitions              | [Manifest and runtime schemas](../packages/plugin/src/runtime.ts)                                                       | Not applicable. Unsupported API versions are rejected                                  |
| Notes private data                                        | [Notes schema](../plugins/notes/src/notes.ts)                                                                           | No migrations yet                                                                      |
| Review private data                                       | [Progress schema](../plugins/review/src/scheduler.ts)                                                                   | [Inline legacy conversion](../plugins/review/src/scheduler.ts)                         |
| Backup folder configuration                               | [Configuration schema](../electron/persistence/automatic-backups.ts)                                                    | No migrations yet                                                                      |
| Record replacement journal                                | [Journal schema](../electron/persistence/record-replacement.ts)                                                         | No migrations yet                                                                      |
| Window zoom                                               | [Zoom schema](../electron/shell/zoom.ts)                                                                                | No migrations yet                                                                      |
| AI connections and credentials                            | [Encrypted record schema](../electron/ai/connections/schema.ts)                                                         | [AI migrations](../electron/ai/connections/migrations.ts)                              |
| Data location and transfer journal                        | [Configuration schema](../electron/persistence/data-location/index.ts)                                                  | [Data location migrations](../electron/persistence/data-location/migrations.ts)        |
| Installed plugin envelope                                 | [Record reader](../electron/plugins/storage/index.ts) and [package verification](../packages/plugin/src/package.ts)     | [Installed plugin migrations](../electron/plugins/storage/migrations.ts)               |
| Desktop log entries                                       | [Log entry schema](../shared/logs.ts)                                                                                   | No migrations yet                                                                      |
| Window geometry                                           | [Window state schema](../electron/shell/window-state.ts)                                                                | Not versioned                                                                          |
| Latest launched desktop version                           | [Version reader](../electron/shell/release-launch.ts)                                                                   | Not versioned                                                                          |
