# Compatibility and migrations

Nesso's data formats don't all change with each app release, so their versions are separate from the app version and the plugin API. Being able to read older data does not mean an older app can read newer data or run newer plugins.

## Data

New releases retain the migration steps needed to read valid data in supported older formats. Startup and backup restoration share those steps for the app's persisted records. Unknown versions and malformed records are reported rather than silently overwritten.

When startup upgrades a persisted record, it saves a backup of the originals before writing the new version. If that backup fails, the upgrade is not saved. Reading or converting a file in memory does not change its source or require a backup.

Migrations preserve saved information and its meaning, except where an explicitly documented retention policy removes older data. [Review](../plugins/review/README.md#api), for example, keeps the learning state and the latest 20 review logs. The scheduler uses the learning state rather than those logs to plan future reviews. Older logs are discarded on the next rating, so Review does not promise to preserve a complete history.

Plugins manage their own private data formats and migrations. The host preserves their payloads when migrating storage records but does not interpret their fields or upgrade the plugin's code.

## Plugin API

Nesso supports only the current plugin API version. There are no adapters or feature negotiation, and no promised support period for superseded API versions. A plugin targeting an unsupported version is not loaded, but its installed record and private data are retained.

An `apiVersion` describes the complete contract, including behavior and permissions. Plugins already compatible with that version remain compatible as the app changes. A change that requires a newer host gets a new API version, even if it only adds a method. Release notes explain incompatible changes and any plugin updates they require. An API update does not grant extra permissions or migrate private plugin data.

## Downgrades and backups

Neither the app nor plugins automatically convert newer data back to an older format. Returning to an older version requires originals or a backup from before the upgrade that the older version can read. That snapshot does not include changes made after it was saved. A matching `apiVersion` does not guarantee that an older plugin can read private data written by a newer plugin.

An app backup contains the document and its workspace, preferences, conversation, and private plugin data. It does not contain provider credentials or installed plugin packages. Restoring it therefore restores saved data, not the whole installation or earlier plugin code.

## Data formats

A format gets its own version when it can outlive the code that wrote it or pass between independently updated components, and its meaning needs to be preserved. Structures that always change together can share a version. Disposable state such as window geometry can remain unversioned when falling back to defaults is an acceptable recovery. A version change is needed when the format's structure or meaning requires an explicit conversion.

Each module handles validation and conversion for the formats it uses. The table below links to that code. "No migrations yet" describes an already versioned format with no conversion steps, while "Not versioned" means the format has no version field.

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
| Backup folder configuration                               | [Configuration schema](../electron/automatic-backups.ts)                                                                | No migrations yet                                                                      |
| Record replacement journal                                | [Journal schema](../electron/record-replacement.ts)                                                                     | No migrations yet                                                                      |
| Window zoom                                               | [Zoom schema](../electron/zoom.ts)                                                                                      | No migrations yet                                                                      |
| AI connections and credentials                            | [Encrypted record schema](../electron/ai-connections.ts)                                                                | Not versioned                                                                          |
| Data location and transfer journal                        | [Configuration schema](../electron/data-location.ts)                                                                    | Not versioned                                                                          |
| Installed plugin envelope                                 | [Record reader](../electron/plugin-storage.ts) and [package verification](../packages/plugin/src/package.ts)            | Not versioned; package and API versions do not version this envelope                   |
| Window geometry                                           | [Window state schema](../electron/window-state.ts)                                                                      | Not versioned                                                                          |
