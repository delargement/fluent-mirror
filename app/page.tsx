import FluentMirror from '@/components/fluent-mirror';
import { requireChatGPTUser } from './chatgpt-auth';

export default async function Home(){
 await requireChatGPTUser('/');
 return <FluentMirror/>;
}
