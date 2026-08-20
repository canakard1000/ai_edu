export interface Quiz { id: string; prompt: string; choices: string[]; answer: number; explanation: string; }
export interface DailyProgress { dateKey: string; answers: Record<string, number>; streak: number; lastCompletedDate?: string; }
export const QUIZZES: Quiz[] = [
  {id:'memory',prompt:'다음 중 기억력을 자극하는 활동으로 가장 알맞은 것은?',choices:['새 정보를 의미와 연결하기','답을 보며 반복하기','한 번에 오래 외우기'],answer:0,explanation:'새 정보를 기존 지식과 연결하면 기억 단서가 늘어납니다.'},
  {id:'focus',prompt:'집중이 흐트러질 때 가장 좋은 첫 행동은?',choices:['알림을 계속 확인하기','짧게 방해 요소를 정리하기','여러 일을 동시에 시작하기'],answer:1,explanation:'짧은 정리와 한 가지 목표 설정이 집중 재시작에 도움이 됩니다.'},
  {id:'logic',prompt:'2, 6, 12, 20, 다음 수는?',choices:['26','30','32'],answer:1,explanation:'차이가 4, 6, 8이므로 다음 차이는 10입니다.'}
];
export function score(progress: DailyProgress): number { return Object.entries(progress.answers).reduce((sum,[id,value]) => sum + (QUIZZES.find((quiz)=>quiz.id===id)?.answer===value ? 1 : 0),0); }
export function isComplete(progress: DailyProgress): boolean { return Object.keys(progress.answers).length === QUIZZES.length; }
export function nextStreak(previous: DailyProgress, dateKey: string): number { if (!previous.lastCompletedDate) return 1; const delta=(new Date(`${dateKey}T00:00:00`).getTime()-new Date(`${previous.lastCompletedDate}T00:00:00`).getTime())/86400000; return delta===1 ? previous.streak+1 : delta===0 ? previous.streak : 1; }
export function updateAnswer(progress: DailyProgress, id: string, answer: number): DailyProgress { return {...progress,answers:{...progress.answers,[id]:answer}}; }
export function complete(progress: DailyProgress, dateKey: string): DailyProgress { return {...progress,dateKey,lastCompletedDate:dateKey,streak:nextStreak(progress,dateKey)}; }
