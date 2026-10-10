import { readFileSync } from 'node:fs';
import { NessoError } from '../src/store/errors.ts';

export function releaseNotes(changelog: string, tag: string): string {
  const version = tag.replace(/^v/, '');
  const sections = changelog.split(/^## /m).slice(1);
  const entry = sections.find((section) => section.startsWith(`${version} — `));
  if (!entry) throw new NessoError([{ path: 'CHANGELOG.md', message: `missing entry for ${tag}` }]);
  return `## ${entry.trim()}\n`;
}

if (import.meta.main) {
  try {
    const tag = process.argv[2];
    if (!tag || process.argv.length !== 3) {
      throw new NessoError([{ path: 'release-notes', message: 'usage: node scripts/release-notes.ts <tag>' }]);
    }
    process.stdout.write(releaseNotes(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'), tag));
  } catch (unknownError) {
    console.error(unknownError instanceof Error ? unknownError.message : unknownError);
    process.exit(1);
  }
}
