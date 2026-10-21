'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, AudioLines, Bookmark, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Download, Focus, Globe2, Headphones, History, Keyboard, Mic, MicOff, Play, Settings2, Sparkles, Square, Volume2, VolumeX, Waves, X } from 'lucide-react';
import { Correction, Turn, SavedSession, Language, Mode, languages, languageCodes, samples, greetings, modeDescriptions, wordDiff, formatTime, normalizeCorrection } from '@/lib/mirror';
import { createCorrectionQueue } from '@/lib/correction-queue';

function uid(){return typeof crypto.randomUUID==='function'?crypto.randomUUID():`fm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}
async function json<T>(r:Response):Promise<T>{return await r.json() as T}

type View = 'practice' | 'history' | 'saved';
type Settings = {language: Language; level: string; style: string; topic: string; sound: boolean};
const defaults: Settings = {language:'German',level:'B1 · Intermediate',style:'Sound natural',topic:'Getting to know you',sound:true};
const topics = [{name:'Getting to know you',icon:'01',desc:'Everyday life, interests & little stories.'},{name:'At the café',icon:'02',desc:'Order something good. Keep the conversation going.'},{name:'University life',icon:'03',desc:'Your studies, ideas & what comes next.'},{name:'Weekend plans',icon:'04',desc:'Places to go, people to see, things to try.'},{name:'A friendly debate',icon:'05',desc:'Share an opinion and make your case.'}];
const navItems = [{id:'practice' as View,label:'Live practice',Icon:AudioLines},{id:'history' as View,label:'Session history',Icon:History},{id:'saved' as View,label:'Saved phrases',Icon:Bookmark}];

function Logo(){return <span className="brandmark" aria-hidden="true"><i/><i/></span>}
function Equalizer({active=false}:{active?:boolean}){return <span className={`equalizer ${active?'moving':''}`} aria-hidden="true">{Array.from({length:19},(_,i)=><i key={i} style={{height:`${[7,13,22,12,28,35,19,27,41,23,34,17,28,13,23,10,17,9,5][i]}px`,animationDelay:`${i*.075}s`}}/>)}</span>}
function readLocal<T,>(key:string,fallback:T):T{try { const value=localStorage.getItem(key); return value ? JSON.parse(value):fallback; }catch{return fallback}}
function normalizeTurn(turn:Turn):Turn{return {...turn,...normalizeCorrection(turn.original,turn)}}

export default function FluentMirror({demoOnly=false}:{demoOnly?:boolean}){
 const [view,setView] = useState<View>('practice');
 const [settings,setSettings] = useState<Settings>(defaults);
 const [mode,setMode] = useState<Mode>('Flow');
 const [modal,setModal] = useState<'settings'|'topics'|'connect'|'help'|'summary'|null>(null);
 const [history,setHistory] = useState<SavedSession[]>([]), [saved,setSaved] = useState<Turn[]>([]);
 const [turns,setTurns] = useState<Turn[]>([]), [selected,setSelected] = useState(-1);
 const [draft,setDraft] = useState(''), [reply,setReply] = useState('');
 const [status,setStatus] = useState<'idle'|'connecting'|'live'|'demo'|'ending'>('idle');
 const [seconds,setSeconds] = useState(0),[muted,setMuted]=useState(false),[focus,setFocus]=useState(false),[showWhy,setShowWhy]=useState(false),[showChanges,setShowChanges]=useState(true);
 const [busy,setBusy]=useState(false),[demoStep,setDemoStep]=useState(0),[ready,setReady]=useState(false),[toast,setToast]=useState(''),[typed,setTyped]=useState(false),[input,setInput]=useState('');
 const [review,setReview]=useState<SavedSession|null>(null);
 const peer=useRef<RTCPeerConnection|null>(null),channel=useRef<RTCDataChannel|null>(null),stream=useRef<MediaStream|null>(null),audio=useRef<HTMLAudioElement|null>(null);
 const liveStarted=useRef(false);
 const pending=useRef(''),lastEnd=useRef(0),outputEnd=useRef(0),outputText=useRef(''),lastCorrection=useRef('');
 const [correctionQueue]=useState(()=>createCorrectionQueue(2));
 const pauseTimer=useRef<ReturnType<typeof setTimeout>|null>(null),demoTimer=useRef<ReturnType<typeof setInterval>|null>(null),closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const generation=useRef(0),turnsRef=useRef<Turn[]>([]),settingsRef=useRef(settings),modeRef=useRef(mode);
 const active=status==='live'||status==='demo';
 const current=turns[selected]||null;
 const example=samples[settings.language][0];
 const original=draft||current?.original||example.original;
 const corrected=current?.corrected||example.corrected;
 const diff=wordDiff(original,corrected);
 const isSample=turns.length===0&&!draft;
 const isSaved=!!current&&saved.some(t=>t.id===current.id);

 function notify(text:string){setToast(text)}
 function persist(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value))}catch{notify('Your browser could not save this. Export your session to keep a copy.')}}
 function stopAudio(){window.speechSynthesis?.cancel()}
 function cleanup(){liveStarted.current=false;correctionQueue.cancel();
  if(turnsRef.current.some(t=>t.pending)){
   const next=turnsRef.current.map(t=>t.pending?{...t,pending:false,corrected:t.original,explanation:'The voice session ended before this correction arrived.',category:'Not reviewed'}:t);
   turnsRef.current=next;setTurns(next);
  }
  setBusy(false);
  if(pauseTimer.current)clearTimeout(pauseTimer.current);
  if(demoTimer.current)clearInterval(demoTimer.current);
  if(closeTimer.current)clearTimeout(closeTimer.current);
  stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;
  if(channel.current){channel.current.onclose=null;channel.current.close();channel.current=null}
  if(peer.current){peer.current.onconnectionstatechange=null;peer.current.close();peer.current=null}
  if(audio.current){audio.current.pause();audio.current.srcObject=null}
  stopAudio();setMuted(false);
 }
 useEffect(()=>{
  setSettings({...defaults,...readLocal<Settings>('fm-settings',defaults)});
  setHistory(readLocal<SavedSession[]>('fm-history',[]).map(s=>({...s,turns:s.turns.map(normalizeTurn)})));setSaved(readLocal<Turn[]>('fm-saved',[]).map(normalizeTurn));
  if(!demoOnly)fetch('/api/status').then(r=>json<{ready:boolean}>(r)).then(d=>setReady(!!d.ready)).catch(()=>setReady(false));
  return ()=>{generation.current++;cleanup()};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[demoOnly]);
 useEffect(()=>{settingsRef.current=settings; if(audio.current)audio.current.muted=!settings.sound},[settings]);
 useEffect(()=>{modeRef.current=mode;setShowWhy(mode==='Coach')},[mode]);
 useEffect(()=>{turnsRef.current=turns},[turns]);
 useEffect(()=>{if(!active)return;const t=setInterval(()=>setSeconds(s=>s+1),1000);return()=>clearInterval(t)},[active]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{
  const handler=(e:KeyboardEvent)=>{if(e.key==='Escape'){setModal(null);setFocus(false)}if(e.code==='Space'&&e.altKey){e.preventDefault();toggleMute()}};
  window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
 });
 useEffect(()=>{
  if(status==='live'&&channel.current?.readyState==='open') channel.current.send(JSON.stringify({type:'session.instructions.append',event_id:uid(),delegation_id:null,content:voiceInstructions()}));
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[mode]);

 function changeSettings(next:Settings){setSettings(next);settingsRef.current=next;persist('fm-settings',next)}
 function speak(text:string,language:Language=settings.language){
  if(!('speechSynthesis'in window)){notify('Pronunciation playback is not available in this browser.');return}
  stopAudio();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=languageCodes[language];utterance.rate=.86;
  const voices=window.speechSynthesis.getVoices();const voice=voices.find(v=>v.lang===utterance.lang)||voices.find(v=>v.lang.startsWith(utterance.lang.slice(0,2)));if(voice)utterance.voice=voice;
  utterance.onerror=(event)=>{if(event.error!=='canceled'&&event.error!=='interrupted')notify('No pronunciation voice is available for this language in your browser.')};
  window.speechSynthesis.speak(utterance);
 }
 function voiceInstructions(){const s=settingsRef.current;const m=modeRef.current;return `You are a warm, curious language conversation partner in Fluent Mirror. Speak ${s.language} at ${s.level} level. Topic: ${s.topic}. Ask one short question at a time and leave room for the user. Do not read grammar corrections aloud; a separate panel handles corrections. ${m==='Coach'?'Offer a brief explanation only if asked.':m==='Shadow'?'Help the user practise repeating improved sentences. When they repeat a sentence, acknowledge briefly and wait.':'Keep the conversation natural and flowing.'}`}
 function addTurn(original:string,result:Correction,demo:boolean,isPending=false){
  const t:Turn={...result,id:uid(),original,language:settingsRef.current.language,demo,timestamp:Date.now(),pending:isPending};
  const next=[...turnsRef.current,t];turnsRef.current=next;setTurns(next);setSelected(next.length-1);setDraft(pending.current);
  if(!isPending&&modeRef.current==='Shadow'){setMuted(true);stream.current?.getAudioTracks().forEach(t=>t.enabled=false);if(audio.current)audio.current.muted=true;speak(t.corrected,t.language)}
  return t;
 }
 async function correct(text:string){
  if(demoOnly){notify('This public demo uses prepared sample sentences.');return}
  if(!text.trim()||text===lastCorrection.current)return;
  lastCorrection.current=text;const ticket=generation.current;setBusy(true);
  const context=turnsRef.current.slice(-3).map(t=>t.original);const settingsAtStart={...settingsRef.current};
  const turn=addTurn(text,{corrected:text,explanation:'Checking your words…',category:'Checking'},false,true);
  const queuedAt=performance.now();
  function finish(result:Correction){
   if(ticket!==generation.current)return;
   const next=turnsRef.current.map(t=>t.id===turn.id?{...t,...result,pending:false}:t);
   turnsRef.current=next;setTurns(next);setBusy(next.some(t=>t.pending));
  }
  correctionQueue.enqueue(async signal=>{
   if(ticket!==generation.current)return;
   const requestAt=performance.now();
   try{
    const response=await fetch('/api/correct',{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language:settingsAtStart.language,style:settingsAtStart.style,context})});
    const data=await json<Correction & {error?:string;timing?:{model:string;durationMs:number}}>(response);if(!response.ok)throw new Error(data.error||'Correction could not be loaded.');
    if(ticket!==generation.current||signal.aborted)return;
    finish(normalizeCorrection(text,data));
    console.info('[Fluent Mirror] correction timing',{queueMs:Math.round(requestAt-queuedAt),requestMs:Math.round(performance.now()-requestAt),...data.timing});
    // An older response must not interrupt a newer sentence or its audio.
    if(modeRef.current==='Shadow'&&turnsRef.current.at(-1)?.id===turn.id&&!pending.current){setMuted(true);stream.current?.getAudioTracks().forEach(t=>t.enabled=false);if(audio.current)audio.current.muted=true;speak(data.corrected,turn.language)}
   }catch(e){if(ticket===generation.current&&!signal.aborted){finish({corrected:text,explanation:'This sentence could not be reviewed. Try again later.',category:'Not reviewed'});lastCorrection.current='';notify(e instanceof Error?e.message:'Correction failed.')}}
  });
 }
 function flush(){const text=pending.current.trim();if(!text)return;pending.current='';void correct(text);}
 function onEvent(event:{type:string;delta?:string;start_ms?:number;end_ms?:number;error?:{message?:string}}){
  if(event.type==='session.started'){liveStarted.current=true;if(closeTimer.current)clearTimeout(closeTimer.current);setStatus('live');setReply('I’m here. Start speaking whenever you’re ready.');channel.current?.send(JSON.stringify({type:'session.commentary.append',event_id:uid(),delegation_id:null,content:`Greet the user now in ${settingsRef.current.language} and ask one short question about ${settingsRef.current.topic}, then listen.`}));}
  if(event.type==='session.input_transcript.delta'){
   if(pauseTimer.current)clearTimeout(pauseTimer.current);
   if(typeof event.start_ms==='number'&&event.start_ms-lastEnd.current>1100&&pending.current.trim())flush();
   pending.current+=event.delta||'';lastEnd.current=event.end_ms||lastEnd.current;setDraft(pending.current);setSelected(turnsRef.current.length-1);
   pauseTimer.current=setTimeout(flush,pending.current.trim().split(/\s+/).length<=3?1300:900);
  }
  if(event.type==='session.output_transcript.delta'){
   if(typeof event.start_ms==='number'&&event.start_ms-outputEnd.current>1800)outputText.current='';
   outputText.current+=event.delta||'';outputEnd.current=event.end_ms||outputEnd.current;setReply(outputText.current);
  }
  if(event.type==='session.closed'){cleanup();setStatus('idle')}
  if(event.type==='error')notify(event.error?.message||'The voice connection reported an error.');
 }
 function resetSession(){generation.current++;correctionQueue.cancel();turnsRef.current=[];setTurns([]);setSelected(-1);setDraft('');setReply('');setSeconds(0);setDemoStep(0);setBusy(false);pending.current='';outputText.current='';lastEnd.current=0;outputEnd.current=0;lastCorrection.current='';setView('practice');setReview(null)}
 async function startLive(){
  if(demoOnly){playDemo();return}
  setModal(null);resetSession();setStatus('connecting');const ticket=generation.current;
  try{
   const capability=await fetch('/api/status').then(r=>json<{ready:boolean}>(r));if(!capability.ready){setReady(false);setStatus('idle');setModal('connect');return}setReady(true);
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Microphone access requires a supported browser and a secure connection.');
   const media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(ticket!==generation.current){media.getTracks().forEach(t=>t.stop());return}stream.current=media;
   const pc=new RTCPeerConnection();peer.current=pc;audio.current=new Audio();audio.current.autoplay=true;audio.current.muted=!settingsRef.current.sound;
   pc.ontrack=e=>{if(audio.current){audio.current.srcObject=new MediaStream([e.track]);audio.current.play().catch(()=>notify('Tap the speaker button to enable your partner’s voice.'))}};
   media.getAudioTracks().forEach(t=>pc.addTrack(t,media));
   const dc=pc.createDataChannel('oai-events');channel.current=dc;
   dc.onmessage=e=>{try{onEvent(JSON.parse(e.data))}catch{notify('A voice message could not be read.')}};
   dc.onclose=()=>{if(ticket===generation.current){cleanup();setStatus('idle');notify('The voice session disconnected. Your corrections are still here.')}};
   pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'){cleanup();setStatus('idle');notify('Connection lost. Please start a new session.')}};
   await pc.setLocalDescription(await pc.createOffer());
   if(pc.iceGatheringState!=='complete') await new Promise<void>((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Connection timed out. Please try again.')),10000);const check=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(t);pc.removeEventListener('icegatheringstatechange',check);resolve()}};pc.addEventListener('icegatheringstatechange',check);check()});
   const response=await fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp:pc.localDescription?.sdp,language:settingsRef.current.language,level:settingsRef.current.level,topic:settingsRef.current.topic,mode:modeRef.current})});
   const result=await json<{transport:{sdp:string};error?:string}>(response);if(!response.ok)throw new Error(result.error||'Could not start the session.');if(ticket!==generation.current)return;
   await pc.setRemoteDescription({type:'answer',sdp:result.transport.sdp});
   closeTimer.current=setTimeout(()=>{if(!liveStarted.current){cleanup();setStatus('idle');notify('Voice connection timed out. Please try again.')}},15000);
  }catch(error){if(ticket!==generation.current)return;cleanup();setStatus('idle');notify(error instanceof Error?error.message:'Microphone access was not granted.')}
 }
 function playDemo(){setModal(null);resetSession();setStatus('demo');setBusy(true);setReply(greetings[settings.language]);const ticket=generation.current;setTimeout(()=>{if(ticket===generation.current)runDemoTurn(0)},350)}
 function runDemoTurn(index:number){
  if(demoTimer.current)clearInterval(demoTimer.current);stopAudio();setMuted(false);setBusy(true);setDraft('');
  const sample=samples[settingsRef.current.language][index%samples[settingsRef.current.language].length];const words=sample.original.split(' ');let i=0;const ticket=generation.current;
  demoTimer.current=setInterval(()=>{if(ticket!==generation.current){if(demoTimer.current)clearInterval(demoTimer.current);return}i++;setDraft(words.slice(0,i).join(' '));if(i>=words.length){if(demoTimer.current)clearInterval(demoTimer.current);setTimeout(()=>{if(ticket!==generation.current)return;addTurn(sample.original,sample,true);setReply(sample.reply);setBusy(false);setDemoStep(index+1)},650)}},125);
 }
 function toggleMute(){
  if(status==='demo'){if(busy){notify('Wait for this sample sentence to finish.');return}setMuted(m=>!m);stopAudio();return}
  if(status!=='live')return;const next=!muted;setMuted(next);stream.current?.getAudioTracks().forEach(t=>t.enabled=!next);if(audio.current)audio.current.muted=next||!settingsRef.current.sound;
 }
 function endSession(){
  if(status==='connecting'){generation.current++;cleanup();setStatus('idle');return}
  if(pending.current.trim()){const text=pending.current.trim();pending.current='';setDraft('');addTurn(text,{corrected:text,explanation:'This final fragment was saved without a correction because the session ended.',category:'Not reviewed'},false)}
  if(demoTimer.current)clearInterval(demoTimer.current);generation.current++;correctionQueue.cancel();setBusy(false);stopAudio();
  const finishedTurns=turnsRef.current.map(t=>t.pending?{...t,pending:false,corrected:t.original,explanation:'The session ended before this correction arrived.',category:'Not reviewed'}:t);
  turnsRef.current=finishedTurns;setTurns(finishedTurns);
  if(channel.current?.readyState==='open'){
   setStatus('ending');stream.current?.getAudioTracks().forEach(t=>t.enabled=false);channel.current.send(JSON.stringify({type:'session.close'}));closeTimer.current=setTimeout(()=>{cleanup();setStatus('idle');notify('Session ended. Final voice usage could not be confirmed.')},15000);
  }else{cleanup();setStatus('idle')}
  const record:SavedSession={id:uid(),date:Date.now(),language:settingsRef.current.language,mode:modeRef.current,topic:settingsRef.current.topic,seconds,turns:turnsRef.current,demo:status==='demo'};
  if(record.turns.length){const next=[record,...history].slice(0,50);setHistory(next);persist('fm-history',next)}setReview(record);setModal('summary');
 }
 function savePhrase(t:Turn){const exists=saved.some(p=>p.id===t.id);const next=exists?saved.filter(p=>p.id!==t.id):[t,...saved];setSaved(next);persist('fm-saved',next);notify(exists?'Phrase removed.':'Phrase saved for later.')}
 function exportSession(session:SavedSession){const text=`Fluent Mirror · ${session.language} · ${session.mode}\n${new Date(session.date).toLocaleString()} · ${formatTime(session.seconds)}${session.demo?' · Demo session':''}\n${session.topic}\n\n`+session.turns.map(t=>`YOU SAID\n${t.original}\nSAY IT BETTER\n${t.corrected}\n${t.explanation}`).join('\n\n');const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`fluent-mirror-${new Date(session.date).toISOString().slice(0,10)}.txt`;a.click();URL.revokeObjectURL(url)}
 function openHistory(s:SavedSession){setReview(s);setView('history')}
 async function submitTyped(){const text=input.trim();if(!text)return;if(!ready){setModal('connect');return}setInput('');setDraft(text);await correct(text)}
 function chooseLanguage(language:Language){changeSettings({...settings,language});setReply('');setTurns([]);turnsRef.current=[];setSelected(-1);setDraft('')}
 function resumeShadow(){stopAudio();setMuted(false);stream.current?.getAudioTracks().forEach(t=>t.enabled=true);if(audio.current)audio.current.muted=!settings.sound;notify(status==='demo'?'Demo: try saying the improved sentence out loud.':'Your turn. Repeat the sentence, then keep talking.')}

 return <div className={`app-shell ${focus?'focus-mode':''}`}>
  <aside className="sidebar">
   <a className="brand" href={demoOnly?'./':'/'} aria-label="Fluent Mirror home"><Logo/><span>fluent<span className="brand-light">mirror</span><small>A clearer way to speak.</small></span></a>
   <div className="workspace-label">YOUR SPACE</div>
   <nav aria-label="Main navigation">{navItems.map(({id,label,Icon})=><button key={id} className={`nav-item ${view===id?'selected':''}`} onClick={()=>{setView(id);setReview(null)}}><Icon size={19}/><span>{demoOnly&&id==='practice'?'Practice demo':label}</span>{id==='practice'&&<span className="nav-dot"/>}{id==='saved'&&saved.length>0&&<span className="count">{saved.length}</span>}</button>)}</nav>
   <div className="sidebar-note"><span className="small-spark"><Sparkles size={17}/></span><h3>Progress sounds like you.</h3><p>A few imperfect sentences are better than a perfect silence.</p><span className="note-line"/></div>
   <div className="sidebar-bottom"><button className="nav-item" onClick={()=>setModal('settings')}><Settings2 size={18}/>Practice settings</button><button className="nav-item" onClick={()=>setModal('help')}><CircleHelp size={18}/>A little guidance</button><div className="profile"><div className="avatar">Y</div><div>Your personal space<small>Just you. Room to grow.</small></div><span className="private-tag">{demoOnly?'DEMO':'PRIVATE'}</span></div></div>
  </aside>
  <div className="main-shell">
   <header className="topbar"><div className="breadcrumb">Your space <ChevronRight size={13}/><strong>{view==='practice'?(demoOnly?'Practice demo':'Live practice'):view==='history'?'Session history':'Saved phrases'}</strong></div><div className="top-actions"><span className={`connection-status ${active?'on':''}`}><i/>{status==='demo'?'Demo session':status==='live'?'Connected':status==='connecting'?'Connecting…':status==='ending'?'Finishing…':'Ready when you are'}</span><button title="Practice settings" aria-label="Practice settings" className="icon-btn" onClick={()=>setModal('settings')}><Settings2 size={18}/></button></div></header>
   {demoOnly&&<div className="demo-notice" role="note"><strong>Public demo</strong><span>Prepared conversations. No API key, microphone access, or AI usage charges.</span></div>}
   {view==='practice'?<main className="practice-main">
    <div className="page-heading"><div><div className="eyebrow"><span/> A LITTLE PRACTICE, A LITTLE POSSIBILITY</div><h1>Find your flow<span>.</span></h1><p>Speak freely. Let your words find their better version.</p></div><button className={`outline-btn focus-btn ${focus?'chosen':''}`} onClick={()=>setFocus(!focus)}><Focus size={16}/>{focus?'Exit focus':'Focus mode'}</button></div>
    <div className="session-settings"><div className="language-control"><span className={`flag flag-${settings.language.toLowerCase()}`}/><select aria-label="Practice language" value={settings.language} disabled={status!=='idle'} onChange={e=>chooseLanguage(e.target.value as Language)}>{languages.map(l=><option key={l}>{l}</option>)}</select><ChevronDown size={14}/></div><span className="divider"/><span className="level-label">{settings.level}</span><button className="topic-chip" disabled={status!=='idle'} onClick={()=>setModal('topics')}><span className="topic-dot"/>{settings.topic}<ChevronDown size={13}/></button><span className="session-settings-spacer"/><span className="session-clock"><Clock3 size={14}/>{formatTime(seconds)}</span></div>
    <div className="practice-grid"><section className="mirror-workspace" aria-label="Speech mirror">
     <div className="mirror-toolbar"><div className="mode-tabs" role="tablist" aria-label="Practice mode">{(['Flow','Coach','Shadow'] as Mode[]).map(m=><button role="tab" aria-selected={mode===m} key={m} className={mode===m?'active':''} onClick={()=>setMode(m)}>{m==='Flow'?<Waves size={15}/>:m==='Coach'?<Sparkles size={15}/>:<Headphones size={15}/>}{m}</button>)}</div><button className="text-btn" onClick={()=>setShowChanges(!showChanges)}><span className={`toggle ${showChanges?'checked':''}`} />Show changes</button></div>
     <div className="mode-hint">{modeDescriptions[mode]}</div>
     <article className={`speech-card original-card ${draft?'transcribing':''}`}><div className="card-label"><span><Mic size={15}/>YOU SAID</span><span className="card-state">{isSample?'EXAMPLE':draft?'TRANSCRIBING':current?.demo?'DEMO TRANSCRIPT':'YOUR WORDS'}</span></div><div className="sentence" lang={languageCodes[settings.language]}>{draft?draft:<>{diff.old.map((w,i)=><span key={i} className={showChanges&&w.changed?'removed':''}>{w.text}{' '}</span>)}</>}{draft&&<i className="caret"/>}</div><div className="card-footer"><span className="quiet-label">{draft?'Your words, as they arrive.':'Every thought starts somewhere.'}</span><span className="speech-dots" aria-hidden="true">•••</span></div></article>
     <div className="mirror-bridge"><span/><div><ArrowDown size={14}/></div><span/></div>
     <article className={`speech-card corrected-card ${busy||current?.pending?'processing':''}`} aria-busy={busy||!!current?.pending}><div className="card-label"><span><Sparkles size={15}/>SAY IT BETTER</span><span className="natural-pill"><span/>{current?.demo||isSample?'Sample correction':settings.style==='Sound natural'?'A little more natural':'Grammar polished'}</span></div><div className="sentence corrected-sentence" lang={languageCodes[settings.language]} aria-live="polite">{(draft&&busy)||current?.pending?<span className="waiting-text">A clearer reflection is on its way<span className="loading-dots">…</span></span>:diff.next.map((w,i)=><span key={i} className={showChanges&&w.changed?'improved':''}>{w.text}{' '}</span>)}</div><div className="correction-actions"><button className="text-btn why-btn" aria-expanded={showWhy} onClick={()=>setShowWhy(!showWhy)}><BookOpen size={14}/>{showWhy?'Hide explanation':'Why this works'}<ChevronDown size={12} className={showWhy?'rotate':''}/></button><div className="small-actions"><button className="icon-btn" aria-label="Listen to corrected sentence" title="Listen to pronunciation" disabled={!!current?.pending||!!draft} onClick={()=>speak(corrected)}><Volume2 size={17}/></button><button className={`icon-btn ${isSaved?'is-saved':''}`} aria-label={isSaved?'Unsave phrase':'Save phrase'} title="Save phrase" disabled={!current||!!draft||!!current.pending} onClick={()=>current&&savePhrase(current)}>{isSaved?<Check size={17}/>:<Bookmark size={17}/>}</button></div></div>{showWhy&&<div className="explanation"><span>{current?.category||example.category}</span><p>{current?.explanation||example.explanation}</p></div>}{mode==='Shadow'&&current&&<button className="shadow-prompt" onClick={resumeShadow}><Mic size={15}/>{muted?'Your turn — repeat it aloud':'Repeat the sentence at your own pace'}<ArrowRight size={15}/></button>}</article>
     <div className="mirror-under"><span><span className="legend-dot"/>Same meaning. A smoother way to say it.</span>{turns.length>0&&<div className="turn-nav"><button className="icon-btn" aria-label="Previous sentence" disabled={selected<=0||!!draft} onClick={()=>setSelected(s=>s-1)}><ChevronLeft size={16}/></button><span>{selected+1} / {turns.length}</span><button className="icon-btn" aria-label="Next sentence" disabled={selected>=turns.length-1||!!draft} onClick={()=>setSelected(s=>s+1)}><ChevronRight size={16}/></button></div>}</div>
     {typed&&!demoOnly&&<form className="typed-form" onSubmit={e=>{e.preventDefault();void submitTyped()}}><input aria-label="Sentence to correct" placeholder={`Type a sentence in ${settings.language}…`} maxLength={2000} value={input} onChange={e=>setInput(e.target.value)} autoFocus/><button className="icon-btn" type="submit" disabled={busy||!input.trim()} aria-label="Correct sentence"><ArrowRight size={18}/></button></form>}
     <div className="session-dock"><div className="dock-status"><div className={`mic-indicator ${active&&!muted?'active':''}`}><Mic size={17}/></div><div><strong>{status==='connecting'?'Finding your connection…':status==='ending'?'Finishing your session…':status==='demo'?(muted?'Demo paused':'A glimpse of the flow'):status==='live'?(muted?'Microphone muted':'The floor is yours'):'A conversation starts with you.'}</strong><small>{status==='demo'?'Sample speech · your microphone is off':status==='live'?'Your partner is listening. Take your time.':demoOnly?'Explore sample sentences at your own pace.':'Put on your headphones. Take a breath.'}</small></div></div><div className="dock-buttons">{active?<><button className={`icon-btn mute-btn ${muted?'muted':''}`} onClick={toggleMute} aria-label={muted?'Unmute microphone':'Mute microphone'} title="Alt + Space">{muted?<MicOff size={19}/>:<Mic size={19}/>}</button><button className="end-btn" onClick={endSession}><Square size={13} fill="currentColor"/>End session</button></>:status==='connecting'?<button className="outline-btn" onClick={endSession}>Cancel</button>:<button className="primary-btn" disabled={status==='ending'} onClick={()=>demoOnly?playDemo():ready?void startLive():setModal('connect')}>{demoOnly?<Play size={17}/>:<Mic size={17}/>} {demoOnly?'Try a demo':'Start speaking'}<ArrowRight size={16}/></button>}</div></div>
     <div className="below-dock">{!demoOnly&&<button className="text-btn" onClick={()=>setTyped(!typed)}><Keyboard size={14}/>{typed?'Hide keyboard':'Prefer to type?'}</button>}{status==='demo'?<button className="text-btn demo-next" disabled={busy||muted} onClick={()=>runDemoTurn(demoStep)}>Next sample<ArrowRight size={13}/></button>:<button className="text-btn" disabled={status!=='idle'} onClick={()=>demoOnly?setModal('help'):playDemo()}><Play size={12}/>{demoOnly?'How the demo works':'Try a demo'}</button>}<span><Headphones size={12}/>Best with headphones</span></div>
    </section><aside className="right-rail"><section className="partner-card"><div className="rail-title">YOUR CONVERSATION PARTNER<button className="icon-btn" aria-label={settings.sound?'Mute partner audio':'Enable partner audio'} title="Partner audio" onClick={()=>{changeSettings({...settings,sound:!settings.sound});if(audio.current&& !settings.sound)void audio.current.play();if(settings.sound)stopAudio()}}>{settings.sound?<Volume2 size={16}/>:<VolumeX size={16}/>}</button></div><div className={`orb-scene ${active&&!muted?'breathing':''}`} aria-hidden="true"><div className="orb-orbit orbit-one"/><div className="orb-orbit orbit-two"/><div className="orb"><div className="orb-shine"/><Equalizer active={active&&!muted}/></div><span className="orb-shadow"/></div><div className="partner-name">A good listener.<br/>An even better conversation.</div><div className="partner-caption"><span className={`status-dot ${status==='live'?'live':''}`}/>{status==='live'?'AI voice partner · connected':status==='demo'?'Demo · sample conversation':demoOnly?'Prepared sample partner':'AI voice partner'}</div><div className="partner-prompt"><span>{reply?'YOUR PARTNER':'A PLACE TO BEGIN'}</span><p lang={languageCodes[settings.language]}>“{reply||greetings[settings.language]}”</p></div></section>
     <section className="gentle-card"><span className="gentle-icon"><Waves size={20}/></span><h3>Stay in the conversation.</h3><p>Glance at your reflection when you pause. You don’t have to catch every correction.</p><div className="gentle-footer"><span/>Fluency comes from showing up.</div></section>
     <button className="session-topic" disabled={status!=='idle'} onClick={()=>setModal('topics')}><span className="topic-icon"><Globe2 size={17}/></span><div>Something to talk about<small>Explore conversation starters</small></div><ArrowRight size={16}/></button>
    </aside></div><footer className="page-footer"><Logo/><span>A safe space to sound like yourself. Just a little more fluent.</span><button className="text-btn" onClick={()=>setModal('help')}>How it works<ArrowRight size={12}/></button></footer>
   </main>:<main className="library-main"><div className="page-heading"><div><div className="eyebrow">YOUR WORDS, WORTH KEEPING</div><h1>{view==='history'?'Look how far you’ve come':'Make these words yours'}<span>.</span></h1><p>{view==='history'?'A little reflection goes a long way.':'Good phrases deserve a second conversation.'}</p></div></div>{view==='history'?(review?<><button className="text-btn back-link" onClick={()=>setReview(null)}><ArrowLeft size={15}/>All sessions</button><div className="review-header"><div><h2>{review.topic}</h2><p>{review.language} · {review.mode} · {formatTime(review.seconds)} {review.demo?'· Demo':''}</p></div><button className="outline-btn" onClick={()=>exportSession(review)}><Download size={16}/>Export</button></div><div className="review-turns">{review.turns.map(t=><PhraseCard key={t.id} turn={t} saved={saved.some(p=>p.id===t.id)} onSave={()=>savePhrase(t)} onSpeak={()=>speak(t.corrected,t.language)}/>)}</div></>:history.length?<div className="history-list">{history.map(s=><button key={s.id} className="history-row" onClick={()=>openHistory(s)}><span className="history-icon"><AudioLines size={23}/></span><div><h3>{s.topic}</h3><p>{s.language} · {s.mode} · {s.turns.length} {s.turns.length===1?'reflection':'reflections'} {s.demo?'· Demo':''}</p></div><time>{new Date(s.date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time><span>{formatTime(s.seconds)}</span><ChevronRight size={18}/></button>)}</div>:<Empty icon="history" title="Your first conversation is waiting." text="End a practice session and your reflections will be saved here, on this browser." action={()=>setView('practice')}/>):saved.length?<div className="review-turns">{saved.map(t=><PhraseCard key={t.id} turn={t} saved onSave={()=>savePhrase(t)} onSpeak={()=>speak(t.corrected,t.language)}/>)}</div>:<Empty icon="saved" title="A few words to come back to." text="Tap the bookmark on a correction to keep it here. Your collection grows one phrase at a time." action={()=>setView('practice')}/>}</main>}
  </div>
  {modal&&<Modal onClose={()=>setModal(null)}>
   {modal==='connect'&&!demoOnly&&<><span className="modal-symbol"><Mic size={25}/></span><div className="eyebrow">YOUR FIRST CONVERSATION</div><h2>A voice on the other side.</h2><p>Live conversations and personal corrections need an OpenAI API connection. Your ChatGPT subscription doesn’t automatically connect this app.</p><div className="connection-box"><span className="status-dot"/><div><strong>{ready?'OpenAI is connected':'Live voice is not connected yet'}</strong><small>{ready?'You’re ready for your first conversation.':'The app is ready. API setup is the remaining step.'}</small></div></div><p className="modal-small">Explore the mirror with a sample conversation now. Demo mode uses prepared sentences and keeps your microphone off.</p><button className="primary-btn wide" onClick={()=>ready?void startLive():playDemo()}>{ready?<Mic size={16}/>:<Play size={16}/>} {ready?'Start live conversation':'Try the demo'}<ArrowRight size={16}/></button><button className="text-btn center" onClick={async()=>{const r=await fetch('/api/status').then(r=>json<{ready:boolean}>(r)).catch(()=>({ready:false}));setReady(!!r.ready);notify(r.ready?'OpenAI is connected. You can start speaking.':'API setup is still needed. Continue setup in the chat.')}}>Check connection</button></>}
   {modal==='settings'&&<><div className="eyebrow">MAKE YOURSELF AT HOME</div><h2>Your practice, your pace.</h2><p>{demoOnly?'Choose a sample language and feedback mode. Demo sentences are prepared; level, topic, and style do not generate new conversations.':'Choose how you’d like the conversation to feel.'}</p><div className="settings-form"><label>Practice language<select disabled={status!=='idle'} value={settings.language} onChange={e=>chooseLanguage(e.target.value as Language)}>{languages.map(l=><option key={l}>{l}</option>)}</select></label><label>Conversation level<select disabled={status!=='idle'} value={settings.level} onChange={e=>changeSettings({...settings,level:e.target.value})}>{['A1 · Just beginning','A2 · Finding my feet','B1 · Intermediate','B2 · Confident','C1 · Advanced','C2 · Near-native'].map(l=><option key={l}>{l}</option>)}</select></label><label>Correction style<select value={settings.style} onChange={e=>changeSettings({...settings,style:e.target.value})}><option>Sound natural</option><option>Grammar only</option></select></label><label className="switch-label"><span>Play your partner’s voice<small>You can still read the conversation.</small></span><button role="switch" aria-label="Play partner voice" aria-checked={settings.sound} className={`toggle large ${settings.sound?'checked':''}`} onClick={()=>changeSettings({...settings,sound:!settings.sound})}/></label></div>{status!=='idle'&&<p className="modal-small">End this session to change its language, level, or topic.</p>}<p className="modal-small">History and saved phrases stay in this browser. No audio recordings are saved by this app.</p><button className="primary-btn wide" onClick={()=>setModal(null)}>All set<Check size={16}/></button></>}
   {modal==='topics'&&<><div className="eyebrow">FOLLOW YOUR CURIOSITY</div><h2>Where shall we begin?</h2><p>A starting point is all you need. The conversation can go anywhere.</p><div className="topic-list">{topics.map(t=><button key={t.name} onClick={()=>{changeSettings({...settings,topic:t.name});setModal(null)}}><span>{t.icon}</span><div><strong>{t.name}</strong><p>{t.desc}</p></div>{settings.topic===t.name?<Check size={18}/>:<ArrowRight size={17}/>}</button>)}</div></>}
   {modal==='help'&&<><div className="eyebrow">MEET YOUR MIRROR</div><h2>Keep talking.<br/>We’ll find the words.</h2><p>{demoOnly?'Explore a prepared conversation: sample speech appears above, with its corrected version below. Use Next sample to continue.':'Have a real conversation with an AI partner. Your words appear above; a clearer version appears below.'}</p><div className="help-steps"><div><span>01</span><p><strong>Say what’s on your mind.</strong>Your transcript follows along as you speak.</p></div><div><span>02</span><p><strong>Catch your reflection.</strong>Corrections appear after a pause. Green highlights show what changed.</p></div><div><span>03</span><p><strong>Make it yours.</strong>Listen, read the explanation, or save a phrase for later.</p></div></div><p className="modal-small">Flow keeps feedback quiet. Coach explains each correction. Shadow lets you listen and repeat. Pronunciation playback uses your browser’s available voices.</p><button className="primary-btn wide" onClick={()=>setModal(null)}>Let’s find the flow<ArrowRight size={16}/></button></>}
   {modal==='summary'&&review&&<><span className="modal-symbol"><Check size={28}/></span><div className="eyebrow">A LITTLE MORE FLUENT</div><h2>That was time well spoken.</h2><p>{review.demo?'You’ve tried the mirror. Your sample reflections are labeled as demo practice.':'Every sentence was practice. Here’s what you’re taking with you.'}</p><div className="summary-grid"><div><strong>{formatTime(review.seconds)}</strong><span>Time in conversation</span></div><div><strong>{review.turns.length}</strong><span>Reflections to revisit</span></div></div><button className="primary-btn wide" onClick={()=>{setModal(null);setView('history')}}>Review your session<ArrowRight size={16}/></button><button className="text-btn center" onClick={()=>exportSession(review)}><Download size={15}/>Export conversation</button></>}
  </Modal>}
  {toast&&<div className="toast" role="status"><span>{toast}</span><button className="icon-btn" aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={15}/></button></div>}
 </div>
}
function Modal({children,onClose}:{children:React.ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null);const closeRef=useRef(onClose);closeRef.current=onClose;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const root=ref.current;root?.focus();const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')closeRef.current();if(e.key==='Tab'&&root){const items=Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]'));const first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===root)){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}};document.addEventListener('keydown',handler);return()=>{document.removeEventListener('keydown',handler);previous?.focus()}},[]);
 return <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div ref={ref} role="dialog" aria-modal="true" aria-label="Fluent Mirror dialog" tabIndex={-1} className="modal"><button className="modal-close icon-btn" aria-label="Close dialog" onClick={onClose}><X size={20}/></button>{children}</div></div>
}
function Empty({icon,title,text,action}:{icon:string;title:string;text:string;action:()=>void}){return <div className="empty-state"><span>{icon==='history'?<History size={32}/>:<Bookmark size={32}/>}</span><h2>{title}</h2><p>{text}</p><button className="primary-btn" onClick={action}>Back to practice<ArrowRight size={16}/></button></div>}
function PhraseCard({turn,saved,onSave,onSpeak}:{turn:Turn;saved:boolean;onSave:()=>void;onSpeak:()=>void}){const d=wordDiff(turn.original,turn.corrected);return <article className="phrase-card"><div className="phrase-meta"><span>{turn.language} · {turn.category}{turn.demo?' · Demo':''}</span><div><button className="icon-btn" aria-label="Listen to phrase" onClick={onSpeak}><Volume2 size={17}/></button><button className={`icon-btn ${saved?'is-saved':''}`} aria-label={saved?'Remove saved phrase':'Save phrase'} onClick={onSave}>{saved?<Bookmark size={17} fill="currentColor"/>:<Bookmark size={17}/>}</button></div></div><p className="phrase-original">{turn.original}</p><p className="phrase-improved">{d.next.map((w,i)=><span className={w.changed?'improved':''} key={i}>{w.text}{' '}</span>)}</p><p className="phrase-explanation">{turn.explanation}</p></article>}
