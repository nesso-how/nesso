import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { releaseNotes } from './release-notes.ts';

function fixture(context: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'nesso-release-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const cwd = join(directory, 'project');
  mkdirSync(join(cwd, 'scripts'), { recursive: true });
  mkdirSync(join(cwd, 'src/store'), { recursive: true });
  for (const file of ['scripts/release.ts', 'scripts/release-notes.ts', 'src/store/errors.ts', 'cliff.toml']) {
    copyFileSync(new URL(`../${file}`, import.meta.url), join(cwd, file));
  }
  symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), join(cwd, 'node_modules'), 'junction');
  writeFileSync(join(cwd, '.gitignore'), 'node_modules\n');
  writeFileSync(join(cwd, 'package.json'), '{"type":"module","version":"1.0.0-alpha.1"}\n');
  writeFileSync(join(cwd, 'CHANGELOG.md'), '# Changelog\n\n');
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Release Test');
  git('config', 'user.email', 'release@example.com');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  git('add', '.');
  git('commit', '-m', 'chore: initialize');
  git('tag', 'v1.0.0-alpha.1');
  git('init', '--bare', join(directory, 'remote.git'));
  git('remote', 'add', 'origin', join(directory, 'remote.git'));
  const commit = (message: string) => git('commit', '--allow-empty', '-m', message);
  const release = (...args: string[]) => execFileSync(process.execPath, ['scripts/release.ts', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const changelog = () => readFileSync(join(cwd, 'CHANGELOG.md'), 'utf8');
  return { cwd, git, commit, release, changelog };
}

test('releases commit incremental prerelease notes and roll them up for stable versions', (context) => {
  const project = fixture(context);
  project.commit('feat(canvas): add zoom');
  project.commit('fix: keep selection');
  project.commit('perf: speed up rendering');
  project.commit('chore: update tooling');
  project.commit('refactor(storage)!: replace document format\n\nBREAKING CHANGE: saved documents need reimporting');
  project.release('--alpha');
  const alpha = releaseNotes(project.changelog(), 'v1.0.0-alpha.2');
  assert.match(alpha, /### Features/);
  assert.match(alpha, /### Fixes/);
  assert.match(alpha, /### Performance/);
  assert.match(alpha, /### Breaking Changes/);
  assert.match(alpha, /saved documents need reimporting/);
  assert.doesNotMatch(alpha, /update tooling/);
  assert.equal(project.git('status', '--porcelain'), '');
  assert.equal(project.git('show', '--format=', '--name-only', 'HEAD'), 'CHANGELOG.md\npackage.json');
  assert.equal(project.git('rev-parse', 'HEAD'), project.git('rev-parse', 'v1.0.0-alpha.2'));
  assert.match(project.git('ls-remote', 'origin', 'refs/heads/main', 'refs/tags/v1.0.0-alpha.2'), /refs\/tags\/v1\.0\.0-alpha\.2/);
  project.commit('fix: restore viewport');
  project.release('--beta');
  const beta = releaseNotes(project.changelog(), 'v1.0.0-beta.1');
  assert.match(beta, /Restore viewport/);
  assert.doesNotMatch(beta, /add zoom/i);
  project.release('1.0.0');
  const stable = releaseNotes(project.changelog(), 'v1.0.0');
  assert.match(stable, /Add zoom/);
  assert.match(stable, /Restore viewport/);
  project.commit('feat: export images');
  project.release('1.1.0-alpha.1');
  project.commit('fix: preserve image size');
  project.release('1.1.0');
  const next = releaseNotes(project.changelog(), 'v1.1.0');
  assert.match(next, /Export images/);
  assert.match(next, /Preserve image size/);
  assert.doesNotMatch(next, /add zoom|restore viewport/i);
  const published = execFileSync(process.execPath, ['scripts/release-notes.ts', 'v1.1.0'], { cwd: project.cwd, encoding: 'utf8' });
  assert.equal(published, next);
});

test('releasing the current version still commits its changelog before tagging', (context) => {
  const project = fixture(context);
  project.git('tag', '-d', 'v1.0.0-alpha.1');
  project.commit('chore: refresh dependencies');
  project.release();
  assert.match(releaseNotes(project.changelog(), 'v1.0.0-alpha.1'), /No user-facing changes/);
  assert.equal(project.git('show', '--format=', '--name-only', 'HEAD'), 'CHANGELOG.md');
  assert.equal(project.git('rev-parse', 'HEAD'), project.git('rev-parse', 'v1.0.0-alpha.1'));
  project.release('--alpha');
  assert.match(releaseNotes(project.changelog(), 'v1.0.0-alpha.2'), /No user-facing changes/);
});

test('changelog generation failures leave the version, history and tags unchanged', (context) => {
  const project = fixture(context);
  writeFileSync(join(project.cwd, 'cliff.toml'), 'invalid = [');
  project.git('add', 'cliff.toml');
  project.git('commit', '-m', 'chore: configure changelog');
  const head = project.git('rev-parse', 'HEAD');
  const result = spawnSync(process.execPath, ['scripts/release.ts', '--alpha'], { cwd: project.cwd, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(project.git('status', '--porcelain'), '');
  assert.equal(project.git('rev-parse', 'HEAD'), head);
  assert.equal(project.git('tag', '--list', 'v1.0.0-alpha.2'), '');
});
