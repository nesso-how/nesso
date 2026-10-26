import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';

function fixture(context: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'nesso-plugin-release-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const cwd = join(directory, 'project');
  mkdirSync(join(cwd, 'scripts'), { recursive: true });
  mkdirSync(join(cwd, 'packages', 'plugin'), { recursive: true });
  copyFileSync(new URL('../scripts/release-plugin.ts', import.meta.url), join(cwd, 'scripts', 'release-plugin.ts'));
  copyFileSync(new URL('../scripts/release-common.ts', import.meta.url), join(cwd, 'scripts', 'release-common.ts'));
  symlinkSync(fileURLToPath(new URL('../node_modules', import.meta.url)), join(cwd, 'node_modules'), 'junction');
  writeFileSync(join(cwd, '.gitignore'), 'node_modules\n');
  writeFileSync(join(cwd, 'packages', 'plugin', 'package.json'), '{"name":"@nesso/test","version":"0.1.1"}\n');
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Release Test');
  git('config', 'user.email', 'release@example.com');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  git('add', '.');
  git('commit', '-m', 'chore: initialize');
  git('init', '--bare', join(directory, 'remote.git'));
  git('remote', 'add', 'origin', join(directory, 'remote.git'));
  const release = (...args: string[]) => execFileSync(process.execPath, ['scripts/release-plugin.ts', ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const manifest = () => JSON.parse(readFileSync(join(cwd, 'packages', 'plugin', 'package.json'), 'utf8')) as { version?: unknown };
  return { cwd, git, release, manifest };
}

test('plugin releases bump the SDK version, tag plugin-v and push both', (context) => {
  const project = fixture(context);
  project.git('commit', '--allow-empty', '-m', 'feat: extend SDK');
  const tag = project.release('--patch');
  assert.equal(tag, 'plugin-v0.1.2');
  assert.equal(project.manifest().version, '0.1.2');
  assert.equal(project.git('show', '--format=', '--name-only', 'HEAD'), 'packages/plugin/package.json');
  assert.equal(project.git('rev-parse', 'HEAD'), project.git('rev-parse', 'plugin-v0.1.2'));
  assert.equal(project.git('status', '--porcelain'), '');
  assert.match(project.git('ls-remote', 'origin', 'refs/heads/main', 'refs/tags/plugin-v0.1.2'), /refs\/tags\/plugin-v0\.1\.2/);
});

test('plugin releases refuse an existing tag without changing files or history', (context) => {  const project = fixture(context);
  project.git('tag', 'plugin-v0.1.2');
  const head = project.git('rev-parse', 'HEAD');
  const result = spawnSync(process.execPath, ['scripts/release-plugin.ts', '--patch'], { cwd: project.cwd, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(project.manifest().version, '0.1.1');
  assert.equal(project.git('status', '--porcelain'), '');
  assert.equal(project.git('rev-parse', 'HEAD'), head);
});
