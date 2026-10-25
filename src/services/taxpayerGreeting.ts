/** Localized dashboard greeting; never substitutes a fictional name for an authenticated taxpayer. */
export type GreetingLanguage = 'en' | 'bn';

export function taxpayerGreeting(
  language:GreetingLanguage,
  hour:number,
  name:string | null | undefined,
  returning:boolean
):{ salutation:string; welcome:string } {
  const safeHour=Number.isFinite(hour)?Math.max(0,Math.min(23,Math.floor(hour))):12;
  const salutation=language==='bn'
    ? safeHour<12?'সুপ্রভাত':safeHour<17?'শুভ অপরাহ্ণ':'শুভ সন্ধ্যা'
    : safeHour<12?'Good morning':safeHour<17?'Good afternoon':'Good evening';
  const trimmed=(name??'').trim();
  const opening=language==='bn'
    ? returning?'আবারও স্বাগতম':'স্বাগতম'
    : returning?'Welcome back':'Welcome';
  return {salutation,welcome:trimmed?opening+(language==='bn'?' ':', ')+trimmed:opening};
}

/** Supabase timestamps indicate a repeat sign-in only when reliably separated. */
export function isReturningTaxpayer(createdAt?:string|null,lastSignInAt?:string|null):boolean {
  if(!createdAt||!lastSignInAt)return false;
  const created=Date.parse(createdAt),signed=Date.parse(lastSignInAt);
  return Number.isFinite(created)&&Number.isFinite(signed)&&signed-created>30*60*1000;
}
