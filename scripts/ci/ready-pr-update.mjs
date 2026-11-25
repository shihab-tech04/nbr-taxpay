import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const repo = 'shihab-tech04/nbr-taxpay';
const shaPattern = /^[0-9a-f]{40}$/;

export function planReadyUpdate({ pr, main, candidate, remoteHead, isAncestor }) {
  if (pr.state !== 'open' || pr.draft || pr.base?.ref !== 'main' ||
      pr.base?.repo?.full_name !== repo || pr.head?.repo?.full_name !== repo ||
      !pr.head?.ref || pr.head.ref === 'main') throw Error('Expected an existing ready same-repository Main PR');
  if (![main, candidate, remoteHead, pr.head.sha].every(s => shaPattern.test(s))) throw Error('Invalid commit identity');
  if (remoteHead !== pr.head.sha) throw Error('PR head changed; refresh before updating');
  if (candidate === remoteHead) return { action: 'noop' };
  if (!isAncestor(remoteHead, candidate)) throw Error('Candidate does not preserve current PR history');
  if (!isAncestor(main, candidate)) throw Error('Candidate must contain current Main, including CI recovery');
  return { action: 'push', ref: `refs/heads/${pr.head.ref}`, candidate };
}

export function updateReadyPr({ number, apply = false, run }) {
  if (!/^\d+$/.test(String(number)) || Number(number) < 1) throw Error('Use an existing PR number');
  const git = (...args) => run('git', args).trim();
  const readPr = () => JSON.parse(run('gh', ['api', `repos/${repo}/pulls/${number}`]));
  const remote = git('remote', 'get-url', '--push', 'origin');
  if (!['https://github.com/' + repo, 'https://github.com/' + repo + '.git', 'git@github.com:' + repo + '.git', 'ssh://git@github.com/' + repo + '.git'].includes(remote)) throw Error('Unexpected origin push URL');
  if (git('status', '--porcelain')) throw Error('Commit or stash local changes first');
  const candidate = git('rev-parse', 'HEAD');
  const snapshot = () => {
    const pr = readPr();
    const main = git('ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s+/)[0];
    const remoteHead = git('ls-remote', '--exit-code', 'origin', `refs/heads/${pr.head.ref}`).split(/\s+/)[0];
    const isAncestor = (a, b) => { try { git('merge-base', '--is-ancestor', a, b); return true; } catch { return false; } };
    return { pr, main, remoteHead, plan: planReadyUpdate({pr, main, remoteHead, candidate, isAncestor}) };
  };
  const first = snapshot();
  if (!apply || first.plan.action === 'noop') return first.plan;
  const last = snapshot();
  if (last.main !== first.main || last.remoteHead !== first.remoteHead || last.plan.action !== 'push' || last.plan.ref !== first.plan.ref) throw Error('Main or PR changed; do not push');
  git('push', 'origin', `${candidate}:${first.plan.ref}`);
  return first.plan;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [number, flag, ...rest] = process.argv.slice(2);
    if (!number || rest.length || (flag && flag !== '--apply')) throw Error('Usage: node scripts/ci/ready-pr-update.mjs PR_NUMBER [--apply]');
    const result = updateReadyPr({ number, apply: flag === '--apply', run: (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) });
    console.log(JSON.stringify(result));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
