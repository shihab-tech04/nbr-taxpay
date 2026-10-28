/** Display stored request amount exactly in paisa, never as a paid amount. */
export function formattedReviewAmount(minor: string|number, language:'en'|'bn'):string {
  if(typeof minor==='number' && !Number.isSafeInteger(minor))
    throw Error('Unsafe precision for stored request amount');
  const value=String(minor);
  if(!/^\d{1,19}$/.test(value))throw Error('Invalid request amount');
  const paisa=BigInt(value);
  if(paisa<=0n||paisa>9223372036854775807n)throw Error('Invalid request amount');
  const locale=language==='bn'?'bn-BD':'en-BD';
  const whole=new Intl.NumberFormat(locale).format(paisa/100n);
  const fraction=new Intl.NumberFormat(locale,{minimumIntegerDigits:2,useGrouping:false}).format(Number(paisa%100n));
  return '৳ '+whole+'.'+fraction;
}

export function safeReviewStatus(status:unknown):'SUBMITTED_FOR_REVIEW'|'OFFICER_ACKNOWLEDGED'|'INFO_REQUESTED'|'CLOSED'|'UNVERIFIED' {
  if(status==='SUBMITTED_FOR_REVIEW'||status==='OFFICER_ACKNOWLEDGED'||
    status==='INFO_REQUESTED'||status==='CLOSED')return status;
  return 'UNVERIFIED';
}
