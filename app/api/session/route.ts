import { authorize, key, noStore, isLanguage } from '@/lib/server';
export async function POST(request:Request){
 const denied=await authorize(request);if(denied)return denied;
 if(!key())return Response.json({error:'Live voice is not connected yet. API setup is needed before you can start a live session.'},{status:503,headers:noStore});
 try{
  const raw=await request.text();if(raw.length>80000)return Response.json({error:'Request too large.'},{status:413,headers:noStore});
  const b=JSON.parse(raw);
  if(typeof b.sdp!=='string'||!b.sdp.startsWith('v=0')||!isLanguage(b.language)||!['Flow','Coach','Shadow'].includes(b.mode))return Response.json({error:'Invalid session settings.'},{status:400,headers:noStore});
  const level=typeof b.level==='string'?b.level.slice(0,60):'B1';const topic=typeof b.topic==='string'?b.topic.slice(0,120):'Everyday conversation';
  const greeting=`Greet the learner now in ${b.language} and ask one short question about ${topic}, then pause to listen.`;
  const response=await fetch('https://api.openai.com/v1/live/sessions',{method:'POST',headers:{Authorization:`Bearer ${key()}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25000),body:JSON.stringify({session:{model:process.env.OPENAI_VOICE_MODEL||'gpt-live-1',instructions:`You are Fluent Mirror, a warm language conversation partner. Speak ${b.language} at ${level} level. Topic: ${topic}. Be curious and natural. Keep replies to one or two short sentences, ask one question at a time, and wait for the user. Do not recite corrections: a separate text panel shows those. In Shadow mode, allow time for the user to repeat improved sentences. Current mode: ${b.mode}.`,input:[{role:'developer',content:[{type:'input_text',text:greeting}]}]},transport:{type:'webrtc',sdp:b.sdp}})});
  if(!response.ok)return Response.json({error:response.status===401?'The OpenAI connection needs to be updated.':response.status===429?'The OpenAI usage limit was reached. Please try later.':'The live voice session could not be started. Please check API access and try again.'},{status:502,headers:noStore});
  const result=await response.json() as {session:unknown;transport?:{sdp:string}};if(!result.transport?.sdp)return Response.json({error:'The voice service did not return a connection.'},{status:502,headers:noStore});
  return Response.json({session:result.session,transport:result.transport},{status:201,headers:noStore});
 }catch(error){return Response.json({error:error instanceof SyntaxError?'Invalid request.':'The connection timed out. Please try again.'},{status:error instanceof SyntaxError?400:502,headers:noStore})}
}
