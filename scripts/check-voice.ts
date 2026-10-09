import env from '@next/env';
import OpenAI from 'openai';
env.loadEnvConfig(process.cwd());
const base='http://127.0.0.1:3000';
const res=await fetch(base+'/api/realtime-token',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({persona_id:'younghee',demo_only:true})});
const payload=await res.json();
console.log('token route:',res.status,res.ok?'단기 토큰 발급 성공':payload.error?.code);
if(res.ok)console.log('model:',payload.model,'transcription:',payload.transcription_model,'voice:',payload.voice);
else{
 const c=new OpenAI({maxRetries:0});
 try { await c.realtime.clientSecrets.create({session:{type:'realtime',model:process.env.REALTIME_MODEL||'gpt-realtime-2.1'}});console.log('minimal token: success'); }
 catch(e){const err=e as {status?:number;code?:string;type?:string;param?:string};console.log('minimal token error:',JSON.stringify({status:err.status,code:err.code,type:err.type,param:err.param}));}
}
