import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NessoError } from '@nesso/errors';

type ReviewEvent = { type: string; part?: { messageID: string; text: string } };

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new NessoError([{ path: name, message: 'required environment variable is missing' }]);
  return value;
}

function formatReport(result: string, head: string): string {
  const events = result.split('\n').filter(line => line.trim()).map(line => JSON.parse(line) as ReviewEvent);
  if (events.some(event => event.type === 'error')) throw new NessoError([{ path: 'opencode', message: 'review failed' }]);
  const parts = events.flatMap(event => event.type === 'text' && event.part ? [event.part] : []);
  const message = parts.at(-1)?.messageID;
  const report = parts.filter(part => part.messageID === message).map(part => part.text).join('\n').trim();
  if (!report) throw new NessoError([{ path: 'opencode', message: 'review returned no final text' }]);
  const body = report.length > 55000 ? `${report.slice(0, 55000)}\n\nReport truncated.` : report;
  return `## OpenCode advisory review\n\nCommit: ${head}\n\n${body}\n`;
}

async function main(): Promise<void> {
  const token = process.env.OPENCODE_CONSOLE_TOKEN;
  if (!token) {
    console.log('::warning::OpenCode review skipped: add the OPENCODE_API_KEY repository secret.');
    return;
  }
  const base = required('BASE_SHA');
  const head = required('HEAD_SHA');
  const temporary = required('RUNNER_TEMP');
  const output = required('GITHUB_OUTPUT');
  const model = required('REVIEW_MODEL');
  const root = resolve(import.meta.dirname, '..');
  const configHome = mkdtempSync(join(temporary, 'nesso-review-'));
  const config = join(configHome, 'opencode');
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

  mkdirSync(config, { recursive: true });
  const diff = join(configHome, 'changes.diff');
  writeFileSync(diff, git('diff', '--no-ext-diff', '--no-textconv', `${base}...${head}`));

  const response = await fetch('https://opencode.ai/console/api/v2/config', {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new NessoError([{ path: 'console', message: `configuration request failed (${response.status})` }]);
  const consoleConfig = await response.json() as { providers: unknown; policies?: unknown };
  writeFileSync(join(config, 'opencode.json'), JSON.stringify({
    $schema: 'https://opencode.ai/config.json',
    providers: consoleConfig.providers,
    policies: consoleConfig.policies ?? [],
    snapshots: false,
  }));

  const env: NodeJS.ProcessEnv = { ...process.env, XDG_CONFIG_HOME: configHome };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  const result = execFileSync('opencode', [
    'run', '--standalone', '--agent', 'review', '--model', model, '--format', 'json',
    '--file', diff, 'Review the attached PR diff against the checked-out repository.',
  ], { cwd: root, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  writeFileSync(join(temporary, 'review.md'), formatReport(result, head));
  appendFileSync(output, 'ready=true\n');
}

try {
  await main();
} catch (error) {
  const failure = error instanceof NessoError ? error : new NessoError([{ path: 'ci-review', message: error instanceof Error ? error.message : String(error) }]);
  console.error(failure.message);
  process.exitCode = 1;
}
