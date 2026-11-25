// All fixture calls remain loopback-only. In CI the ports must be allocated
// for this exact disposable project, rather than falling back to another job.
function port(value, fallback, required) {
  const raw = value ?? (required ? '' : fallback);
  if (!/^[0-9]+$/.test(raw) || Number(raw) < 1024 || Number(raw) > 65535) {
    throw new Error('Invalid disposable Supabase port');
  }
  return String(Number(raw));
}
export function localSupabaseEndpoints(env = process.env) {
  const required = env.GITHUB_ACTIONS === 'true';
  const apiPort = port(env.TAXPAY_LOCAL_API_PORT, '54321', required);
  const dbPort = port(env.TAXPAY_LOCAL_DB_PORT, '54322', required);
  if (apiPort === dbPort) throw new Error('Disposable API and database ports must differ');
  if (required && (!env.TAXPAY_LOCAL_SUPABASE_URL || !env.TAXPAY_LOCAL_PG_DSN)) {
    throw new Error('Disposable Supabase status endpoints are required in CI');
  }
  const api = new URL(env.TAXPAY_LOCAL_SUPABASE_URL || `http://127.0.0.1:${apiPort}`);
  if (api.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(api.hostname) ||
      api.port !== apiPort || api.username || api.password || api.pathname !== '/' || api.search || api.hash) {
    throw new Error('Disposable Supabase API is not the allocated loopback endpoint');
  }
  if (env.TAXPAY_LOCAL_PG_DSN) {
    const db = new URL(env.TAXPAY_LOCAL_PG_DSN);
    if (db.protocol !== 'postgresql:' || !['127.0.0.1','localhost'].includes(db.hostname) ||
        db.port !== dbPort || db.pathname !== '/postgres') {
      throw new Error('Disposable Supabase SQL is not the allocated loopback endpoint');
    }
  }
  return { origin: api.origin, dbPort };
}
