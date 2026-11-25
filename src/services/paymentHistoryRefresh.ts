/** One mounted owner/view's SQL refresh queue. Events invalidate in-flight reads;
 * periodic fallback never overlaps them. No financial writes or cached receipts. */
export function createPaymentHistoryRefresh<T>(read:()=>Promise<T>,apply:(value:T)=>void,fail:(error:unknown)=>void){
  let disposed=false,running=false,requested=false;
  const drain=async()=>{
    if(disposed||running)return;
    running=true;
    try{
      while(requested&&!disposed){
        requested=false;
        try{
          const result=await read();
          if(!disposed&&!requested)apply(result);
        }catch(error){if(!disposed&&!requested)fail(error);}
      }
    }finally{running=false;}
  };
  const refresh=()=>{if(disposed)return;requested=true;void drain();};
  const poll=()=>{if(!running)refresh();};
  const dispose=()=>{disposed=true;requested=false;};
  return {refresh,poll,dispose};
}
