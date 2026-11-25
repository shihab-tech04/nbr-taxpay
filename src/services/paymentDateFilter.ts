/** Inclusive date-only bounds for payment timestamps, using the browser's local calendar day. */
function localDayBoundary(value:string,endOfDay:boolean):number|null{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const [year,month,day]=value.split('-').map(Number);
  const date=new Date(year,month-1,day);
  if(date.getFullYear()!==year||date.getMonth()!==month-1||date.getDate()!==day)return null;
  if(endOfDay)date.setHours(23,59,59,999);
  else date.setHours(0,0,0,0);
  return date.getTime();
}

export function paymentDateInRange(timestamp:string,fromDate:string,toDate:string):boolean{
  if(!fromDate&&!toDate)return true;
  const instant=Date.parse(timestamp);
  if(!Number.isFinite(instant))return false;
  const from=fromDate?localDayBoundary(fromDate,false):null;
  const to=toDate?localDayBoundary(toDate,true):null;
  if(fromDate&&from===null||toDate&&to===null||from!==null&&to!==null&&from>to)return false;
  return (from===null||instant>=from)&&(to===null||instant<=to);
}
