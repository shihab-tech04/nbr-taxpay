/** Keep an explicitly selected year, but do not silently hide newly recorded
 * payments under a historic demo default on an ordinary account Activity visit.
 * A dashboard drilldown remains scoped to its source assessment year.
 */
export function initialActivityYear(explicit: string|null, fallback: string, isSignedInPreview: boolean, drilldown: boolean): string {
  if (explicit && /^20\d{2}-20\d{2}$/.test(explicit)) return explicit;
  if (drilldown) return fallback;
  if (explicit === 'all' || isSignedInPreview) return 'all';
  return fallback;
}

/** Same-day payments need full timestamps, not just their rendered date. */
export function compareActivityNewestFirst(a:{date:string;occurredAt?:string},b:{date:string;occurredAt?:string}):number {
  return Date.parse(b.occurredAt??b.date)-Date.parse(a.occurredAt??a.date);
}

export function allowLocalActivityExamples(localHost:boolean,signedIn:boolean,localQa:boolean):boolean {
  return localHost&&(!signedIn||localQa);
}

export function selectActivitySource<T>(sql:readonly T[],examples:readonly T[],allowExamples:boolean):T[]{
  return allowExamples?[...examples,...sql]:[...sql];
}
