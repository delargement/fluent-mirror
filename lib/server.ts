import { getChatGPTUser } from '@/app/chatgpt-auth';
export const noStore = { 'Cache-Control': 'no-store' };
export async function authorize(request:Request){
 if(!await getChatGPTUser())return Response.json({error:'Please sign in to use live practice.'},{status:401,headers:noStore});
 const origin=request.headers.get('origin');
 if(!origin || origin!==new URL(request.url).origin)return Response.json({error:'This request must come from Fluent Mirror.'},{status:403,headers:noStore});
 if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Expected a JSON request.'},{status:415,headers:noStore});
 if(Number(request.headers.get('content-length')||0)>80000)return Response.json({error:'This request is too large.'},{status:413,headers:noStore});
 return null;
}
export const key = () => process.env.OPENAI_API_KEY;
export const isLanguage=(value:unknown):value is string=> typeof value==='string'&&['German','French','Spanish','English'].includes(value);
