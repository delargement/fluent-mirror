import { key, noStore } from '@/lib/server';
export const dynamic='force-dynamic';
export async function GET(){return Response.json({ready:!!key()},{headers:noStore})}
