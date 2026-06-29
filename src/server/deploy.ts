import { execFile } from 'node:child_process';
import { spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const githubRepoPattern = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const githubBranchPattern = /^[A-Za-z0-9._/-]+$/;

export type ParsedDeploymentSettings = {
  githubRepo: string;
  githubBranch: string;
};

export function parseDeploymentSettings(input: {
  githubRepo?: string;
  githubBranch?: string;
}): ParsedDeploymentSettings {
  const githubRepo = (input.githubRepo ?? 'effands/asistenq').trim();
  const githubBranch = (input.githubBranch ?? 'master').trim();

  if (!githubRepoPattern.test(githubRepo)) {
    throw new Error('Repository GitHub tidak valid. Gunakan format owner/repo.');
  }

  if (
    !githubBranchPattern.test(githubBranch) ||
    githubBranch.includes('..') ||
    githubBranch.startsWith('/') ||
    githubBranch.endsWith('/') ||
    githubBranch.endsWith('.')
  ) {
    throw new Error('Branch GitHub tidak valid.');
  }

  return { githubRepo, githubBranch };
}

export function buildGitHubRemote(githubRepo: string, githubToken?: string): string {
  if (!githubToken) return 'origin';

  return `https://x-access-token:${encodeURIComponent(githubToken)}@github.com/${githubRepo}.git`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildPassengerRestartScript(appRoot: string): string {
  const normalizedAppRoot = appRoot.replace(/\\/g, '/');
  const passengerPattern = `lsnode:${normalizedAppRoot}`;

  return [
    'mkdir -p tmp',
    'touch tmp/restart.txt',
    `(pkill -f ${shellQuote(passengerPattern)} || true)`
  ].join(' && ');
}

export function schedulePassengerRestart(appRoot: string): void {
  const script = `cd ${shellQuote(appRoot)} && ${buildPassengerRestartScript(appRoot)}`;
  const child = spawn('bash', ['-lc', script], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
}

export async function runCommand(command: string, args: string[], options: {
  cwd: string;
  timeout: number;
  maxBuffer: number;
  env: NodeJS.ProcessEnv;
}): Promise<{ stdout: string; stderr: string }> {
  const executable = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  return execFileAsync(executable, args, options);
}
