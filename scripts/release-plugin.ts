import { readFileSync, writeFileSync } from 'node:fs';
import { NessoError } from '@nesso-how/errors';
import { commitTagPush, fail, guardRelease } from './release-common.ts';

type Version = { major: number; minor: number; patch: number };

const usage = 'usage: pnpm release:plugin [version|--major|--minor|--patch|--help]';
const help = `${usage}

Release the plugin SDK from a clean main branch. Without an argument, release the current version.
Choose an explicit version or bump with --major, --minor or --patch.

Update packages/plugin/package.json, commit the bump, then tag and atomically
push main and the tag to origin. CI publishes @nesso-how/plugin for plugin-v* tags.
Never reuse a tag for a version already on the registry.

--help, -h  Show this help without changing files or publishing a release.`;

function parseVersion(input: string): Version {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(input.trim());
  if (!match) throw new NessoError([{ path: 'version', message: `expected semver, found ${input}` }]);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function formatVersion(version: Version): string {
  return `${version.major}.${version.minor}.${version.patch}`;
}

function compareVersions(a: Version, b: Version): number {
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

function resolveTarget(args: string[], current: Version): Version {
  if (args.length === 0) return current;
  if (args.length > 1) throw new NessoError([{ path: 'version', message: usage }]);
  const arg = args[0] ?? '';
  switch (arg) {
    case '--major':
      return { major: current.major + 1, minor: 0, patch: 0 };
    case '--minor':
      return { major: current.major, minor: current.minor + 1, patch: 0 };
    case '--patch':
      return { major: current.major, minor: current.minor, patch: current.patch + 1 };
    default:
      if (arg.startsWith('-')) throw new NessoError([{ path: 'version', message: usage }]);
      return parseVersion(arg);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(help);
    return;
  }
  const location = new URL('../packages/plugin/package.json', import.meta.url);
  const raw = readFileSync(location, 'utf8');
  const data = JSON.parse(raw) as { version?: unknown };
  if (typeof data.version !== 'string' || data.version === '') fail('packages/plugin/package.json', 'missing version');
  const current = parseVersion(data.version);
  const target = resolveTarget(args, current);
  if (compareVersions(target, current) < 0) fail('version', `target ${formatVersion(target)} is older than current ${formatVersion(current)}`);
  const version = formatVersion(target);
  const tag = `plugin-v${version}`;
  guardRelease(tag);
  const matches = raw.match(/"version":\s*"[^"]*"/g) ?? [];
  if (matches.length !== 1) fail('packages/plugin/package.json', 'expected exactly one version field');
  if (version !== data.version) {
    writeFileSync(location, raw.replace(/("version":\s*")[^"]*(")/, `$1${version}$2`));
  }
  commitTagPush(['packages/plugin/package.json'], `chore(plugin): release ${version}`, tag);
}

try {
  main();
} catch (unknownError) {
  console.error(unknownError instanceof Error ? unknownError.message : unknownError);
  process.exit(1);
}
