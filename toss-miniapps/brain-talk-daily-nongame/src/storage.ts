import type { DailyProgress } from './logic';
const KEY='brain-talk-daily-nongame.progress';
export const DEFAULT_PROGRESS: DailyProgress={dateKey:'',answers:{},streak:0};
export function loadProgress(): DailyProgress { if(typeof window==='undefined'||!window.localStorage)return DEFAULT_PROGRESS; try{return JSON.parse(window.localStorage.getItem(KEY)??'null')??DEFAULT_PROGRESS;}catch{return DEFAULT_PROGRESS;} }
export function saveProgress(value: DailyProgress):void { if(typeof window!=='undefined')window.localStorage.setItem(KEY,JSON.stringify(value)); }
