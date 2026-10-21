export type Language = 'German' | 'French' | 'Spanish' | 'English';
export type Mode = 'Flow' | 'Coach' | 'Shadow';
export type Correction = { corrected: string; explanation: string; category: string };
export type Turn = Correction & { id: string; original: string; language: Language; demo: boolean; timestamp: number };
export type SavedSession = { id: string; date: number; language: Language; mode: Mode; topic: string; seconds: number; turns: Turn[]; demo: boolean };
export const languages: Language[] = ['German', 'French', 'Spanish', 'English'];
export const languageCodes: Record<Language, string> = { German: 'de-DE', French: 'fr-FR', Spanish: 'es-ES', English: 'en-US' };
export const samples: Record<Language, { original: string; corrected: string; explanation: string; category: string; reply: string }[]> = {
 German: [
  { original: 'Ich wohne in Bonn seit drei Jahren, und ich studiere Mathematik.', corrected: 'Ich wohne seit drei Jahren in Bonn und studiere Mathematik.', explanation: '“Seit drei Jahren” usually comes before the place. You can also leave out the second “ich” when both verbs have the same subject.', category: 'Word order', reply: 'Mathematik, wie spannend! Was gefällt dir an deinem Studium am besten?' },
  { original: 'Gestern ich habe mit meine Freunde gekocht.', corrected: 'Gestern habe ich mit meinen Freunden gekocht.', explanation: 'The conjugated verb takes the second position. “Mit” takes the dative: “mit meinen Freunden”.', category: 'Word order & case', reply: 'Das klingt gemütlich. Was habt ihr zusammen gekocht?' },
  { original: 'Ich würde gern ein Doktorand in die USA machen.', corrected: 'Ich würde gern in den USA promovieren.', explanation: '“Promovieren” means to do a PhD. For a location, use the dative: “in den USA”.', category: 'Natural expression', reply: 'Eine spannende Idee! An welcher Universität würdest du gern forschen?' },
  { original: 'Am Wochenende will ich nach Köln gehen, weil es gibt viel zu tun.', corrected: 'Am Wochenende will ich nach Köln fahren, weil es dort viel zu tun gibt.', explanation: 'Use “fahren” for travelling to another city. In a subordinate clause with “weil”, the conjugated verb goes at the end.', category: 'Subordinate clause', reply: 'Köln hat viel zu bieten. Was möchtest du dort unternehmen?' }
 ],
 French: [
  { original: 'Je habite à Bonn depuis trois ans et je étudie les mathématiques.', corrected: 'J’habite à Bonn depuis trois ans et j’étudie les mathématiques.', explanation: 'Before a vowel, “je” becomes “j’”. The present tense with “depuis” describes something that is still happening.', category: 'Elision', reply: 'Les mathématiques, c’est passionnant ! Qu’est-ce qui te plaît dans tes études ?' },
  { original: 'Hier, je suis allé au cinéma avec mes amis et nous avons regardé un film très intéressant.', corrected: 'Hier, je suis allé au cinéma avec mes amis et nous avons vu un film très intéressant.', explanation: 'Your sentence is grammatical. “Voir un film” is the more usual expression for seeing a film at the cinema.', category: 'Natural expression', reply: 'Ça a l’air bien ! De quoi parlait le film ?' }
 ],
 Spanish: [
  { original: 'Vivo en Bonn desde tres años y estudio matemáticas.', corrected: 'Vivo en Bonn desde hace tres años y estudio matemáticas.', explanation: 'Use “desde hace” with a duration. Use “desde” alone with a starting point, such as “desde 2023”.', category: 'Time expressions', reply: '¡Qué interesante! ¿Qué es lo que más te gusta de las matemáticas?' },
  { original: 'Ayer he ido al parque con mis amigos y jugamos fútbol.', corrected: 'Ayer fui al parque con mis amigos y jugamos al fútbol.', explanation: 'With the finished time “ayer”, “fui” is usual. In Spain, the expression is “jugar al fútbol”; “jugar fútbol” is also used in Latin America.', category: 'Past tense', reply: '¡Suena divertido! ¿Juegas al fútbol a menudo?' }
 ],
 English: [
  { original: 'I am living in Bonn since three years and I study mathematics.', corrected: 'I have been living in Bonn for three years, and I study mathematics.', explanation: 'Use the present perfect continuous for an ongoing situation that began in the past. “For” introduces a duration; “since” introduces a starting point.', category: 'Tense & duration', reply: 'Mathematics sounds fascinating. What do you enjoy most about your degree?' },
  { original: 'Yesterday I went to the library for make some research.', corrected: 'Yesterday I went to the library to do some research.', explanation: 'Use “to” plus an infinitive to express purpose. The usual collocation is “do research”.', category: 'Natural expression', reply: 'What were you researching? I’d love to hear about it.' }
 ]
};
export const greetings: Record<Language, string> = { German: 'Erzähl mir ein bisschen von dir. Was machst du gern, wenn du nicht studierst?', French: 'Parle-moi un peu de toi. Qu’est-ce que tu aimes faire pendant ton temps libre ?', Spanish: 'Cuéntame un poco sobre ti. ¿Qué te gusta hacer en tu tiempo libre?', English: 'Tell me a little about yourself. What do you like doing in your free time?' };
export const modeDescriptions: Record<Mode, string> = { Flow: 'Keep talking. Corrections appear quietly when you pause.', Coach: 'Understand each correction with a short explanation.', Shadow: 'Listen to the improved sentence, then say it out loud.' };
export function wordDiff(original: string, corrected: string) {
 const a = original.split(/\s+/), b = corrected.split(/\s+/);
 const table = Array.from({length: a.length + 1}, () => new Array<number>(b.length + 1).fill(0));
 for(let i=a.length-1;i>=0;i--) for(let j=b.length-1;j>=0;j--) table[i][j] = a[i]===b[j] ? 1+table[i+1][j+1] : Math.max(table[i+1][j],table[i][j+1]);
 const old: {text:string; changed:boolean}[] = [], next: {text:string; changed:boolean}[] = [];
 let i=0,j=0;
 while(i<a.length || j<b.length) {
  if(i<a.length && j<b.length && a[i]===b[j]) { old.push({text:a[i++],changed:false}); next.push({text:b[j++],changed:false}); }
  else if(j<b.length && (i===a.length || table[i][j+1]>=table[i+1][j])) next.push({text:b[j++],changed:true});
  else old.push({text:a[i++],changed:true});
 }
 return {old,next};
}
export function formatTime(seconds: number) { return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`; }
