import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import ts from 'typescript';

const SAFE_COMPONENT = /^src\/components\/(?:layout|screens|ui)\/[A-Za-z0-9_-]+\.tsx$/;
function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
}
function stringLeaves(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node];
  if (ts.isConditionalExpression(node)) {
    const left = stringLeaves(node.whenTrue), right = stringLeaves(node.whenFalse);
    return left && right ? [...left, ...right] : null;
  }
  return null;
}
export function jsxCopySignature(source) {
  const file = ts.createSourceFile('copy.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (file.parseDiagnostics.length) return null;
  const spans = [];
  function walk(node) {
    if (ts.isJsxText(node) && node.getText(file).trim()) {
      spans.push([node.getStart(file), node.end]);
    } else if (ts.isJsxExpression(node) && node.expression) {
      const leaves = stringLeaves(node.expression);
      if (leaves) for (const leaf of leaves) spans.push([leaf.getStart(file), leaf.end]);
    }
    ts.forEachChild(node, walk);
  }
  walk(file);
  spans.sort((a,b) => a[0] - b[0]);
  let cursor = 0, normalized = '', count = 0;
  for (const [start,end] of spans) {
    if (start < cursor || end <= start) return null;
    normalized += source.slice(cursor,start) + '__TAXPAY_COPY_TEXT__';
    cursor = end; count++;
  }
  return { normalized: normalized + source.slice(cursor), count };
}
export function copyOnly(base, head) {
  try {
    const lines = git('diff', '--name-status', '--no-renames', base, head).split('\n').filter(Boolean);
    if (lines.length < 1 || lines.length > 4) return false;
    for (const line of lines) {
      const [change,path,...extra] = line.split('\t');
      if (change !== 'M' || extra.length || !SAFE_COMPONENT.test(path)) return false;
      const before = git('show', base + ':' + path);
      const after = git('show', head + ':' + path);
      if (before === after) return false;
      const a = jsxCopySignature(before), b = jsxCopySignature(after);
      if (!a || !b || !a.count || a.normalized !== b.normalized) return false;
    }
    return true;
  } catch { return false; }
}
function checkSuccess(items, name) {
  return items.some(x => x.name === name && x.head_sha === items[0]?.head_sha &&
    x.status === 'completed' && x.conclusion === 'success' &&
    x.app?.slug === 'github-actions');
}
async function githubJson(path) {
  const repo = process.env.GITHUB_REPOSITORY, token = process.env.GH_TOKEN;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !token) throw Error('Missing read-only GitHub context');
  const response = await fetch('https://api.github.com/repos/' + repo + '/' + path, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + token,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw Error('GitHub verification failed: HTTP ' + response.status);
  return response.json();
}
async function releaseMode() {
  const event = process.env.GITHUB_EVENT_NAME, sha = process.env.GITHUB_SHA;
  if (event === 'pull_request') {
    const base = process.env.PR_BASE_SHA, head = process.env.PR_HEAD_SHA;
    if (base && head && copyOnly(base, head)) return {mode:'copy',reason:'Strict display-text-only JSX change'};
    return {mode:'full',reason:'Full checks required for this PR'};
  }
  if (event !== 'push' || process.env.GITHUB_REF !== 'refs/heads/main' || !sha) {
    return {mode:'full',reason:'Manual or unrecognized release'};
  }
  const parents = git('rev-list','--parents','-n','1',sha).split(/\s+/);
  if (parents.length !== 3 || parents[0] !== sha) return {mode:'full',reason:'Not an ordinary merge commit'};
  const base = parents[1], head = parents[2];
  const changes = git('diff','--name-only','--no-renames',base,sha).split('\n').filter(Boolean);
  if (!changes.length || changes.some(x => x.startsWith('.github/') ||
      x.startsWith('scripts/ci/') || x.startsWith('supabase/') ||
      x === 'package-lock.json' || x === 'package.json')) {
    return {mode:'full',reason:'Release or backend infrastructure changed'};
  }
  // The deployed source tree must exactly match Git's automatic merge of the
  // independently tested PR head and the frozen pre-merge Main commit.
  if (git('merge-tree','--write-tree',base,head) !== git('rev-parse',sha + '^{tree}')) {
    return {mode:'full',reason:'Merge tree differs from tested PR merge'};
  }
  const associated = await githubJson('commits/' + sha + '/pulls?per_page=20');
  const pr = Array.isArray(associated) && associated.find(p =>
    p.merged === true && p.merge_commit_sha === sha &&
    p.base?.sha === base && p.head?.sha === head &&
    p.base?.ref === 'main' &&
    p.base?.repo?.full_name === process.env.GITHUB_REPOSITORY &&
    p.head?.repo?.full_name === process.env.GITHUB_REPOSITORY);
  if (!pr) return {mode:'full',reason:'No exact approved same-repo PR'};
  const result = await githubJson('actions/workflows/pages.yml/runs?event=pull_request&head_sha=' + head + '&per_page=50');
  const verifiedRun = result.workflow_runs?.some(r =>
    r.event === 'pull_request' && r.head_sha === head &&
    r.head_branch === pr.head.ref && r.conclusion === 'success' &&
    r.status === 'completed' && new Date(r.updated_at) <= new Date(pr.merged_at));
  if (!verifiedRun) return {mode:'full',reason:'No successful exact-head PR build'};
  const checks = await githubJson('commits/' + head + '/check-runs?per_page=100');
  const completed = (checks.check_runs || []).filter(x => x.head_sha === head);
  const safeCopy = copyOnly(base,head);
  const names = safeCopy
    ? ['Build and verify static preview','Citizen copy-only acceptance','source-backup']
    : ['Build and verify static preview','Isolated local Supabase acceptance (no hosted credentials)','source-backup'];
  if (!names.every(name => checkSuccess(completed,name))) {
    return {mode:'full',reason:'Required exact-head checks not confirmed'};
  }
  return {mode:'verified_merge',reason:'Exact-tree merge of fully verified PR'};
}
if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  let value;
  try { value = await releaseMode(); }
  catch (err) { value = {mode:'full',reason:'Verification unavailable: ' + String(err?.message || err)}; }
  console.log('TaxPay CI: ' + value.mode + ': ' + value.reason);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, 'mode=' + value.mode + '\n');
}
