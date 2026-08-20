import { useEffect, useState } from 'react';
import { HELP_ITEMS, SAMPLE_GROUPS } from './data';
import { createGroup, isJoined, isMine, joinGroup, leaveGroup, monthParticipation, statusOf } from './logic';
import { createShareLink, SHARE_DESCRIPTION, SHARE_TITLE } from './share';
import { loadSnapshot, saveSnapshot } from './storage';
import type { Gathering, Profile, Screen } from './types';

const userId = 'me';
const adConfigured = Boolean(import.meta.env.VITE_AD_GROUP_ID);

function GroupCard({ group, onOpen }: { group: Gathering; onOpen: () => void }) {
  const status = statusOf(group);
  return <button className="group-card" onClick={onOpen} aria-label={`${group.title} 상세보기`}>
    <span className="category">{group.category}</span><strong>{group.title}</strong>
    <span>{group.date}</span><span>{group.place}</span><b className={status}>{group.participantIds.length} / {group.capacity}명 · {status === 'full' ? '마감' : '모집 중'}</b>
  </button>;
}

export default function App() {
  const initial = loadSnapshot();
  const [groups, setGroups] = useState<Gathering[]>(initial.groups);
  const [profile, setProfile] = useState<Profile>(initial.profile);
  const [screen, setScreen] = useState<Screen>('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ title: '', category: '친목', date: '', place: '', capacity: '4', description: '' });

  useEffect(() => { saveSnapshot({ groups, profile }); }, [groups, profile]);
  useEffect(() => {
    const onPopState = () => { setScreen('home'); setSelectedId(null); };
    window.addEventListener('popstate', onPopState); return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const go = (next: Screen) => { if (next !== screen) window.history.pushState({ screen: next }, ''); setScreen(next); };
  const selected = groups.find((item) => item.id === selectedId) ?? null;
  const open = (id: string) => { setSelectedId(id); go('detail'); };
  const updateGroup = (next: Gathering) => setGroups((items) => items.map((item) => item.id === next.id ? next : item));
  const actJoin = (group: Gathering) => { const joined = isJoined(group, userId); updateGroup(joined ? leaveGroup(group, userId) : joinGroup(group, userId)); setToast(joined ? '참여를 취소했어요.' : '모임에 참여했어요.'); };
  const onShare = async () => { const url = await createShareLink(); try { if (navigator.share) await navigator.share({ title: SHARE_TITLE, text: SHARE_DESCRIPTION, url }); else await navigator.clipboard?.writeText(url); setToast('공유 링크를 준비했어요.'); } catch { setToast('공유를 취소했어요.'); } };
  const submit = () => { if (!form.title.trim() || !form.date.trim() || !form.place.trim()) { setToast('모임 이름, 일시, 장소를 입력해 주세요.'); return; } const group = createGroup({ title: form.title.trim(), category: form.category, date: form.date.trim(), place: form.place.trim(), capacity: Math.max(2, Number(form.capacity) || 4), description: form.description.trim() || '새로운 모임입니다.' }, userId); setGroups((items) => [group, ...items]); setForm({ title: '', category: '친목', date: '', place: '', capacity: '4', description: '' }); setToast('새 모임을 만들었어요.'); open(group.id); };
  const reset = () => { setGroups(SAMPLE_GROUPS); setProfile({ id: userId, nickname: '나', notifications: true }); setToast('예시 모임으로 초기화했어요.'); };
  const renderHome = () => <><section className="hero"><p>오늘 같이 할 사람,</p><h1>딱 모여</h1><p>가까운 관심사 모임을 만들고 참여해 보세요.</p><button className="primary" onClick={() => go('create')}>새로운 모임 만들기</button></section><section className="summary"><div><small>이번 달 참여</small><b>{monthParticipation(groups, userId, '2026-08')}회</b></div><div><small>내가 만든 모임</small><b>{groups.filter((group) => isMine(group, userId)).length}개</b></div></section><section className="section-head"><h2>나도 갈래</h2><button onClick={() => go('groups')}>전체 보기</button></section><div className="card-list">{groups.slice(0, 3).map((group) => <GroupCard key={group.id} group={group} onOpen={() => open(group.id)} />)}</div></>;
  const renderGroups = () => <><header><h1>전체 모임</h1><p>관심 있는 모임 카드를 눌러 자세히 확인하세요.</p></header><div className="card-list">{groups.map((group) => <GroupCard key={group.id} group={group} onOpen={() => open(group.id)} />)}</div></>;
  const renderDetail = () => selected ? <><button className="back" onClick={() => go('groups')}>← 모임으로</button><article className="detail"><span className="category">{selected.category}</span><h1>{selected.title}</h1><p>{selected.description}</p><dl><dt>일시</dt><dd>{selected.date}</dd><dt>장소</dt><dd>{selected.place}</dd><dt>참여</dt><dd>{selected.participantIds.length} / {selected.capacity}명</dd><dt>주최</dt><dd>{isMine(selected, userId) ? '내가 만든 모임' : '커뮤니티 회원'}</dd></dl><button className="primary" onClick={() => actJoin(selected)} disabled={!isJoined(selected, userId) && statusOf(selected) === 'full'}>{isJoined(selected, userId) ? '참여 취소' : statusOf(selected) === 'full' ? '모집 마감' : '나도 갈래'}</button></article></> : renderGroups();
  const renderCreate = () => <><button className="back" onClick={() => go('home')}>← 홈으로</button><header><h1>새로운 모임</h1><p>참여자가 이해하기 쉬운 정보만 입력해 주세요.</p></header><div className="form"><label>모임 이름<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="예: 금요일 저녁 산책" /></label><label>카테고리<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}><option>친목</option><option>운동</option><option>스터디</option><option>취미</option><option>동네</option></select></label><label>일시<input value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} placeholder="예: 2026-08-30 14:00" /></label><label>장소<input value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })} placeholder="예: 강남역 10번 출구" /></label><label>정원<input inputMode="numeric" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} /></label><label>소개<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="모임에서 무엇을 하는지 적어 주세요." /></label><button className="primary" onClick={submit}>모임 만들기</button></div></>;
  const renderProfile = () => <><header><h1>내정보</h1><p>모임에서 사용할 정보와 알림을 관리해요.</p></header><div className="form"><label>프로필 이름<input value={profile.nickname} onChange={(event) => setProfile({ ...profile, nickname: event.target.value })} /></label><label className="switch">모임 알림<input type="checkbox" checked={profile.notifications} onChange={(event) => setProfile({ ...profile, notifications: event.target.checked })} /></label><section className="my-groups"><h2>참여 중 모임</h2>{groups.filter((group) => isJoined(group, userId)).map((group) => <button key={group.id} onClick={() => open(group.id)}>{group.title}</button>)}<h2>내가 만든 모임</h2>{groups.filter((group) => isMine(group, userId)).length ? groups.filter((group) => isMine(group, userId)).map((group) => <button key={group.id} onClick={() => open(group.id)}>{group.title}</button>) : <p>아직 만든 모임이 없어요.</p>}</section><button className="secondary" onClick={reset}>내 데이터 초기화</button></div></>;
  const renderHelp = () => <><header><h1>도움</h1><p>안전하고 편안한 만남을 위한 안내입니다.</p></header><div className="help-list">{HELP_ITEMS.map(([title, body]) => <article key={title}><h2>{title}</h2><p>{body}</p></article>)}</div></>;
  return <main><div className="app-bar"><button onClick={() => go('home')} aria-label="딱모여 홈">딱모여</button>{adConfigured ? <span>광고 LIVE</span> : null}</div>{toast ? <div className="toast" role="status">{toast}<button onClick={() => setToast('')}>닫기</button></div> : null}<div className="content">{screen === 'home' && renderHome()}{screen === 'groups' && renderGroups()}{screen === 'detail' && renderDetail()}{screen === 'create' && renderCreate()}{screen === 'profile' && renderProfile()}{screen === 'help' && renderHelp()}</div><nav><button className={screen === 'home' ? 'active' : ''} onClick={() => go('home')}>홈</button><button className={screen === 'groups' || screen === 'detail' ? 'active' : ''} onClick={() => go('groups')}>모임</button><button onClick={() => go('create')}>만들기</button><button onClick={onShare}>공유</button><button className={screen === 'profile' ? 'active' : ''} onClick={() => go('profile')}>내정보</button><button className={screen === 'help' ? 'active' : ''} onClick={() => go('help')}>도움</button></nav></main>;
}
