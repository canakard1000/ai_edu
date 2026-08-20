import { useEffect, useState } from 'react';
import { complete, isComplete, QUIZZES, score, updateAnswer } from './logic';
import { createShareLink } from './share';
import { loadProgress, saveProgress } from './storage';

type Screen='home'|'train'|'challenge'|'review'|'profile';
const today=()=>new Date().toISOString().slice(0,10);

export default function App(){
 const [screen,setScreen]=useState<Screen>('home'); const [progress,setProgress]=useState(loadProgress); const [toast,setToast]=useState('');
 useEffect(()=>saveProgress(progress),[progress]); useEffect(()=>{const onBack=()=>setScreen('home');addEventListener('popstate',onBack);return()=>removeEventListener('popstate',onBack);},[]);
 const go=(next:Screen)=>{if(next!==screen)history.pushState({},'');setScreen(next);}; const answered=Object.keys(progress.answers).length; const done=isComplete(progress); const finish=()=>{if(!done){setToast('문제를 모두 풀어 주세요.');return;}setProgress((value)=>complete(value,today()));setToast('오늘의 두뇌 훈련을 완료했어요.');go('review');};
 const share=async()=>{const url=await createShareLink();try{if(navigator.share)await navigator.share({title:'오늘의 두뇌톡',text:'하루 1분 두뇌 스트레칭을 시작해 보세요.',url});else await navigator.clipboard?.writeText(url);setToast('공유 링크를 준비했어요.');}catch{setToast('공유를 취소했어요.');}};
 const training=<><header><h1>오늘의 훈련</h1><p>{answered}/{QUIZZES.length} 문제를 풀었어요.</p></header>{QUIZZES.map((quiz,index)=><article className="quiz" key={quiz.id}><b>{index+1}. {quiz.prompt}</b>{quiz.choices.map((choice,i)=><button className={progress.answers[quiz.id]===i?'choice selected':'choice'} key={choice} onClick={()=>setProgress((value)=>updateAnswer(value,quiz.id,i))}>{choice}</button>)}</article>)}<button className="primary" onClick={finish}>결과 확인하기</button></>;
 const review=<><header><h1>복습하기</h1><p>오늘 정답은 {score(progress)}/{QUIZZES.length}개예요.</p></header>{QUIZZES.map((quiz)=><article className="review" key={quiz.id}><b>{quiz.prompt}</b><p>{quiz.explanation}</p></article>)}<p className="note">두뇌 훈련 결과는 건강 상태나 의학적 판단을 의미하지 않는 참고 활동입니다.</p></>;
 const challenge=<><header><h1>7일 챌린지</h1><p>매일 짧게 훈련하며 습관을 만들어 보세요.</p></header><div className="streak"><b>{progress.streak}일</b><span>현재 연속 기록</span></div><ul>{['첫날: 오늘의 3문제 풀기','3일차: 복습 완료하기','7일차: 한 주 돌아보기'].map((item)=><li key={item}>{item}</li>)}</ul></>;
 const profile=<><header><h1>내 기록</h1><p>기기에 저장된 오늘의 훈련 기록입니다.</p></header><div className="streak"><b>{progress.streak}일</b><span>연속 훈련</span></div><button className="secondary" onClick={()=>{setProgress({dateKey:'',answers:{},streak:0});setToast('내 기록을 초기화했어요.');}}>기록 초기화</button></>;
 const home=<><section className="hero"><span>하루 1분</span><h1>오늘의 두뇌톡</h1><p>기억력과 집중력을 가볍게 깨워 보세요.</p><button className="primary light" onClick={()=>go('train')}>{done?'오늘 훈련 다시 보기':'오늘의 훈련 시작'}</button></section><section className="stats"><div><small>오늘 진행</small><b>{answered}/{QUIZZES.length}</b></div><div><small>연속 훈련</small><b>{progress.streak}일</b></div></section><section><h2>추천 활동</h2><button className="menu" onClick={()=>go('challenge')}>7일 집중 챌린지 <span>›</span></button><button className="menu" onClick={()=>go('review')}>오늘의 복습 <span>›</span></button></section></>;
 return <main><div className="bar"><button onClick={()=>go('home')}>오늘의 두뇌톡</button></div>{toast&&<div className="toast">{toast}<button onClick={()=>setToast('')}>닫기</button></div>}<div className="content">{screen==='home'&&home}{screen==='train'&&training}{screen==='review'&&review}{screen==='challenge'&&challenge}{screen==='profile'&&profile}</div><nav><button onClick={()=>go('home')}>홈</button><button onClick={()=>go('train')}>훈련</button><button onClick={()=>go('challenge')}>챌린지</button><button onClick={share}>공유</button><button onClick={()=>go('profile')}>내 기록</button></nav></main>;
}
