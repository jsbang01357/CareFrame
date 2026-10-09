import env from '@next/env';
import { fixtures } from '../data/fixtures';
import { initialState } from '../lib/interview/engine';
import { extract } from '../lib/interview/extract';
import { validateCandidates } from '../lib/interview/validate-evidence';
import type { Turn } from '../lib/contracts';
env.loadEnvConfig(process.cwd());
for(const id of ['T05','T06']){
 const part=fixtures.find(f=>f.id===id)!.steps[0];const s=initialState('debug');
 if(part.question)s.last_question_id=part.question;
 const t:Turn={id:crypto.randomUUID(),text:part.text,role:'user',origin:'typed',provider_item_id:null,previous_item_id:null,final:true,prompted_question_id:s.last_question_id,replaces_turn_id:null,created_at:new Date().toISOString()};
 try {const out=await extract(t,s,AbortSignal.timeout(15000));console.log(id,JSON.stringify(out));validateCandidates(out,t);console.log('validated');} catch(e){console.log(id,e instanceof Error?e.name+': '+e.message:'error');}
}
