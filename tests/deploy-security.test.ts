import { describe, expect, it } from 'vitest';
import { buildGitHubRemote, buildPassengerRestartScript, deploymentAuditArgs, deploymentInstallArgs, deploymentPullArgs, parseDeploymentSettings } from '../src/server/deploy';

describe('deployment security helpers', () => {
  it('rejects repository names that could inject shell commands', () => {
    expect(() => parseDeploymentSettings({
      githubRepo: 'effands/asistenq && whoami',
      githubBranch: 'master'
    })).toThrow('Repository GitHub tidak valid');
  });

  it('rejects branch names that could inject shell commands', () => {
    expect(() => parseDeploymentSettings({
      githubRepo: 'effands/asistenq',
      githubBranch: 'master; whoami'
    })).toThrow('Branch GitHub tidak valid');
  });

  it('builds an authenticated GitHub remote without exposing raw token syntax', () => {
    expect(buildGitHubRemote('effands/asistenq', 'ghp_token:with/slash')).toBe(
      'https://x-access-token:ghp_token%3Awith%2Fslash@github.com/effands/asistenq.git'
    );
  });

  it('builds a Passenger restart script scoped to the current app path', () => {
    const script = buildPassengerRestartScript('/home/asistenq/repositories/asistenq');

    expect(script).toContain('tmp/restart.txt');
    expect(script).toContain("lsnode:/home/asistenq/repositories/asistenq");
    expect(script).not.toContain('; rm');
  });

  it('prefers lockfile-based install commands during deploy', () => {
    expect(deploymentInstallArgs(true)).toEqual(['ci', '--include=dev', '--no-audit', '--no-fund']);
  expect(deploymentInstallArgs(false)).toEqual(['install', '--include=dev', '--no-audit', '--no-fund']);
});

it('autostashes server-only edits during deployment pulls', () => {
  expect(deploymentPullArgs('origin', 'master')).toEqual(['pull', '--autostash', 'origin', 'master']);
});

  it('runs an explicit low-level audit after installing dependencies', () => {
    expect(deploymentAuditArgs()).toEqual(['audit', '--audit-level=low']);
  });
});
