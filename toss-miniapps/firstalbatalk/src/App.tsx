import React, { useEffect, useMemo, useRef, useState } from 'react';
import { APP_NAME, FIRST_DAY_CHECKLIST, LOUNGE_POSTS, OFFICIAL_HELP_LINKS } from './data';
import { buildDashboard, calculatePay, completeActiveSession, createActiveSession, describeReferenceNotes, getShiftLabel } from './logic';
import { loadSnapshot, saveSnapshot } from './storage';
import type { AppSettings, ChecklistItem, Screen, WorkEntry } from './types';
import { clamp, formatCurrency, formatDateLabel, formatMinutes, formatTimeLabel, toDateKey } from './utils';
import { SHARE_DESCRIPTION, SHARE_TITLE, createTossShareLink, resolveSharePath } from './share';
import './styles.css';

const NAV_ITEMS: Array<{ screen: Screen; label: string }> = [
  { screen: 'home', label: '홈' },
  { screen: 'records', label: '기록' },
  { screen: 'pay', label: '급여' },
  { screen: 'checklist', label: '첫출근' },
  { screen: 'help', label: '도움' },
  { screen: 'lounge', label: '라운지' },
  { screen: 'profile', label: '내정보' }
];

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message };
  }

  override componentDidCatch(error: Error) {
    console.error(error);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <section className="card fatal-card">
            <p className="eyebrow">오류 복구</p>
            <h1>화면을 다시 불러올 수 없었습니다.</h1>
            <p>{this.state.message || '예기치 않은 오류가 발생했습니다.'}</p>
            <button type="button" className="primary-button" onClick={() => window.location.reload()}>
              다시 불러오기
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function buildInitialChecklist(): ChecklistItem[] {
  return FIRST_DAY_CHECKLIST.map((item) => ({ ...item, done: false }));
}

function AppContent() {
  const initial = useMemo(() => loadSnapshot(), []);
  const [screen, setScreen] = useState<Screen>('home');
  const [records, setRecords] = useState<WorkEntry[]>(initial.records);
  const [activeSession, setActiveSession] = useState<WorkEntry | null>(initial.activeSession);
  const [settings, setSettings] = useState<AppSettings>(initial.settings);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(initial.checklist.length > 0 ? initial.checklist : buildInitialChecklist());
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(initial.records[0]?.id ?? null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(LOUNGE_POSTS[0]?.id ?? null);
  const [tick, setTick] = useState(Date.now());
  const [message, setMessage] = useState('모바일 우선으로 준비되었습니다.');
  const [toast, setToast] = useState('');
  const firstPaintRef = useRef(true);
  const routeRef = useRef<Screen>('home');

  useEffect(() => {
    saveSnapshot({ records, activeSession, settings, checklist });
  }, [records, activeSession, settings, checklist]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (firstPaintRef.current) {
      window.history.replaceState({ screen: 'home' }, '', window.location.pathname + window.location.search);
      routeRef.current = 'home';
      firstPaintRef.current = false;
      return;
    }
    if (routeRef.current !== screen) {
      window.history.pushState({ screen }, '', window.location.pathname + window.location.search);
      routeRef.current = screen;
    }
  }, [screen]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const next = event.state as { screen?: Screen } | null;
      const nextScreen = next?.screen ?? 'home';
      routeRef.current = nextScreen;
      setScreen(nextScreen);
      if (!next?.screen) {
        window.history.replaceState({ screen: 'home' }, '', window.location.pathname + window.location.search);
      }
      setMessage(nextScreen === 'home' ? '홈으로 돌아왔습니다.' : '이전 화면으로 돌아왔습니다.');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const dashboard = useMemo(() => buildDashboard(records, activeSession, settings, new Date(tick)), [records, activeSession, settings, tick]);
  const todayRecords = useMemo(() => records.filter((record) => record.dateKey === toDateKey(new Date(tick))), [records, tick]);
  const monthRecords = useMemo(() => records.filter((record) => record.dateKey.startsWith(toDateKey(new Date(tick)).slice(0, 7))), [records, tick]);
  const currentSelectedRecord = useMemo(() => records.find((record) => record.id === selectedRecordId) ?? records[0] ?? null, [records, selectedRecordId]);
  const selectedPost = useMemo(() => LOUNGE_POSTS.find((post) => post.id === selectedPostId) ?? LOUNGE_POSTS[0] ?? null, [selectedPostId]);
  const adGroupId = (import.meta.env.VITE_AD_GROUP_ID as string | undefined)?.trim() || '';
  const adStatus = adGroupId ? 'LIVE' : 'REQUIRED';
  const sharePath = resolveSharePath(import.meta.env.VITE_SHARE_URL as string | undefined);

  function navigate(next: Screen) {
    setScreen(next);
    setMessage(next === 'home' ? '홈으로 이동했습니다.' : '선택한 화면으로 이동했습니다.');
  }

  function goHome() {
    navigate('home');
    window.history.replaceState({ screen: 'home' }, '', window.location.pathname + window.location.search);
    routeRef.current = 'home';
  }

  function openSection(next: Screen) {
    navigate(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function beginShift() {
    if (activeSession) {
      setToast('이미 근무 중입니다.');
      return;
    }

    const next = createActiveSession(settings, new Date());
    setActiveSession(next);
    setMessage('근무 시작이 기록되었습니다.');
    setToast('근무 시작 기록이 저장되었습니다.');
  }

  function finishShift() {
    if (!activeSession) {
      setToast('진행 중인 근무가 없습니다.');
      return;
    }

    const nextRecord = completeActiveSession(activeSession, new Date());
    setRecords((current) => [nextRecord, ...current]);
    setActiveSession(null);
    setSelectedRecordId(nextRecord.id);
    setMessage('근무 완료가 기록되었습니다.');
    setToast('기록이 저장되었습니다.');
    setScreen('records');
  }

  function updateSettings(patch: Partial<AppSettings>) {
    setSettings((current) => ({
      ...current,
      ...patch
    }));
  }

  function updateNotifications(key: keyof AppSettings['notifications'], value: boolean) {
    setSettings((current) => ({
      ...current,
      notifications: {
        ...current.notifications,
        [key]: value
      }
    }));
  }

  function toggleChecklist(itemId: string) {
    setChecklist((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              done: !item.done
            }
          : item
      )
    );
  }

  function markAllChecklist(value: boolean) {
    setChecklist((current) => current.map((item) => ({ ...item, done: value })));
  }

  async function shareCurrentState() {
    try {
      const shareLink = await createTossShareLink(sharePath);
      const payload = {
        title: SHARE_TITLE,
        text: SHARE_DESCRIPTION,
        url: shareLink
      };

      if (navigator.share) {
        await navigator.share(payload);
        setToast('공유 시트를 열었습니다.');
        return;
      }

      await navigator.clipboard.writeText(`${payload.title}\n${payload.text}\n${payload.url}`);
      setToast('공유 정보를 복사했습니다.');
    } catch {
      setToast('공유 기능을 사용할 수 없습니다.');
    }
  }

  function selectedRecordSummary(record: WorkEntry) {
    const pay = calculatePay(record, new Date(tick));
    return [
      `출근 ${formatTimeLabel(record.startedAt)}`,
      record.endedAt ? `퇴근 ${formatTimeLabel(record.endedAt)}` : '진행 중',
      `휴게 ${record.breakMinutes}분`,
      `실제 근무 ${formatMinutes(pay.minutesWorked)}`,
      `예상급여 ${formatCurrency(pay.totalEstimatedPay)}`
    ];
  }

  function renderHome() {
    return (
      <>
        <section className="hero card">
          <span className="eyebrow">처음 알바하는 사람을 위해</span>
          <h1>
            오늘 근무와 급여를
            <br />
            한눈에 정리하세요.
          </h1>
          <p>근무 시작과 완료, 오늘/이번달 기록, 급여 참고 계산, 첫 출근 준비, 도움 링크, 라운지, 내정보를 한 화면에서 이어갈 수 있게 만들었습니다.</p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={beginShift}>
              근무 시작
            </button>
            <button type="button" className="secondary-button" onClick={finishShift}>
              근무 완료
            </button>
            <button type="button" className="ghost-button" onClick={shareCurrentState}>
              공유
            </button>
          </div>
        </section>

        <section className="stats-grid">
          <StatCard label="오늘 근무" value={dashboard.today.count > 0 ? `${dashboard.today.count}건` : '기록 없음'} note={activeSession ? '근무 진행 중' : '아직 시작 전'} />
          <StatCard label="오늘 예상급여" value={formatCurrency(dashboard.today.pay)} note={`실제 근무 ${formatMinutes(dashboard.today.minutesWorked)}`} />
          <StatCard label="이번달 예상급여" value={formatCurrency(dashboard.month.pay)} note={`이번달 ${dashboard.month.count}건`} />
          <StatCard label="주간 근무시간" value={formatMinutes(dashboard.weekMinutes)} note={dashboard.weeklyHolidayReference > 0 ? '주휴수당 참고값 포함' : '주휴수당 참고 전'} />
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <span className="eyebrow">진행 중</span>
              <h2>오늘 근무</h2>
            </div>
            <button type="button" className="secondary-button" onClick={() => openSection('records')}>
              상세보기
            </button>
          </div>
          {activeSession ? (
            <div className="status-panel good">
              <strong>근무 중</strong>
              <p>{formatTimeLabel(activeSession.startedAt)} 시작 · 지금까지 {formatMinutes(calculatePay(activeSession, new Date(tick)).minutesWorked)} 일했습니다.</p>
            </div>
          ) : (
            <div className="status-panel">
              <strong>아직 근무를 시작하지 않았습니다.</strong>
              <p>근무 시작 버튼을 누르면 진행 중 기록이 저장됩니다.</p>
            </div>
          )}
          <div className="card-actions">
            <button type="button" className="primary-button" onClick={beginShift}>
              근무 시작
            </button>
            <button type="button" className="secondary-button" onClick={finishShift}>
              근무 완료
            </button>
          </div>
        </section>

        <section className="grid-two">
          <DashboardCard title="오늘 근무 기록" subtitle={`${todayRecords.length}건`} onOpen={() => openSection('records')}>
            {todayRecords.length > 0 ? (
              todayRecords.slice(0, 3).map((record) => (
                <button key={record.id} type="button" className="list-row" onClick={() => setSelectedRecordId(record.id)}>
                  <strong>{getShiftLabel(record)}</strong>
                  <span>{formatCurrency(calculatePay(record, new Date(tick)).totalEstimatedPay)}</span>
                </button>
              ))
            ) : (
              <p className="empty-state">오늘 기록이 아직 없습니다.</p>
            )}
          </DashboardCard>

          <DashboardCard title="이번달 근무 기록" subtitle={`${monthRecords.length}건`} onOpen={() => openSection('records')}>
            <p>월 합계 {formatMinutes(dashboard.month.minutesWorked)}</p>
            <p>월 예상급여 {formatCurrency(dashboard.month.pay)}</p>
            <p>주휴수당 참고값 {dashboard.weeklyHolidayReference > 0 ? formatCurrency(dashboard.weeklyHolidayReference) : '조건 미충족'}</p>
          </DashboardCard>
        </section>

        <section className="grid-two">
          <DashboardCard title="첫 출근 준비" subtitle="체크리스트 저장" onOpen={() => openSection('checklist')}>
            <p>근로계약서, 준비물, 담당자 연락처, 출근 경로를 미리 확인해 두세요.</p>
          </DashboardCard>
          <DashboardCard title="내 권리/도움" subtitle="공식기관 연결" onOpen={() => openSection('help')}>
            <p>임금 미지급, 휴게시간, 주휴수당, 야간/연장근로는 공식 기관 링크로 연결합니다.</p>
          </DashboardCard>
          <DashboardCard title="라운지" subtitle="샘플 게시글 포함" onOpen={() => openSection('lounge')}>
            <p>실제 사용자 게시글처럼 보이도록 꾸미지 않고 샘플임을 분명히 표시합니다.</p>
          </DashboardCard>
          <DashboardCard title="내정보" subtitle="시급/알림 수정" onOpen={() => openSection('profile')}>
            <p>시급, 급여일, 알림 설정, 담당자 연락처를 저장할 수 있습니다.</p>
          </DashboardCard>
        </section>

        <section className="card">
          <div className="section-head">
            <div>
              <span className="eyebrow">운영 안내</span>
              <h2>광고/공유</h2>
            </div>
            <button type="button" className="secondary-button" onClick={shareCurrentState}>
              공유하기
            </button>
          </div>
          <div className="status-grid">
            <InfoPill label="광고 상태" value={adStatus} />
            <InfoPill label="공유 링크" value="공유 준비 완료" />
            <InfoPill label="문구" value="샘플/예시와 실제 데이터를 구분합니다." />
          </div>
        </section>
      </>
    );
  }

  function renderRecords() {
    return (
      <section className="card">
        <div className="section-head">
          <div>
            <span className="eyebrow">근무 기록</span>
            <h2>오늘 / 이번달 기록</h2>
          </div>
          <button type="button" className="secondary-button" onClick={() => setScreen('home')}>
            홈으로
          </button>
        </div>
        <div className="stats-grid compact">
          <StatCard label="오늘 합계" value={formatCurrency(dashboard.today.pay)} note={`${formatMinutes(dashboard.today.minutesWorked)} 근무`} />
          <StatCard label="이번달 합계" value={formatCurrency(dashboard.month.pay)} note={`${formatMinutes(dashboard.month.minutesWorked)} 근무`} />
          <StatCard label="주간 합계" value={formatMinutes(dashboard.weekMinutes)} note="주휴수당 참고" />
          <StatCard label="기록 건수" value={`${records.length}건`} note="저장된 전체 기록" />
        </div>

        {currentSelectedRecord && (
          <article className="detail-card">
            <div className="section-head">
              <div>
                <span className="eyebrow">선택한 기록</span>
                <h3>{formatDateLabel(currentSelectedRecord.dateKey)}</h3>
              </div>
              <button type="button" className="secondary-button" onClick={() => setSelectedRecordId(null)}>
                닫기
              </button>
            </div>
            <ul className="detail-list">
              {selectedRecordSummary(currentSelectedRecord).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="reference-note">{describeReferenceNotes(currentSelectedRecord, settings, new Date(tick)).join(' ')}</p>
          </article>
        )}

        <div className="records-list">
          {records.length === 0 ? (
            <div className="empty-state">아직 저장된 근무 기록이 없습니다.</div>
          ) : (
            records.map((record) => {
              const pay = calculatePay(record, new Date(tick));
              return (
                <article key={record.id} className="record-card">
                  <div className="record-topline">
                    <strong>{formatDateLabel(record.dateKey)}</strong>
                    <span>{record.status === 'active' ? '진행 중' : '완료'}</span>
                  </div>
                  <p>{getShiftLabel(record)}</p>
                  <div className="candidate-metrics">
                    <span>실제 근무 {formatMinutes(pay.minutesWorked)}</span>
                    <span>휴게 {record.breakMinutes}분</span>
                    <span>시급 {formatCurrency(record.hourlyWage)}</span>
                    <span>예상급여 {formatCurrency(pay.totalEstimatedPay)}</span>
                  </div>
                  <div className="card-actions">
                    <button type="button" className="secondary-button" onClick={() => setSelectedRecordId(record.id)}>
                      상세보기
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    );
  }

  function renderPay() {
    const activePay = activeSession ? calculatePay(activeSession, new Date(tick)) : null;
    const currentWage = settings.hourlyWage;

    return (
      <section className="card">
        <div className="section-head">
          <div>
            <span className="eyebrow">급여 계산</span>
            <h2>예상 급여</h2>
          </div>
          <button type="button" className="secondary-button" onClick={() => setScreen('home')}>
            홈으로
          </button>
        </div>

        <div className="grid-two">
          <label>
            기본 시급
            <input
              type="number"
              value={currentWage}
              onChange={(event) => updateSettings({ hourlyWage: clamp(Number(event.target.value || 0), 0, 1000000) })}
            />
          </label>
          <label>
            휴게시간(분)
            <input
              type="number"
              value={settings.breakMinutes}
              onChange={(event) => updateSettings({ breakMinutes: clamp(Number(event.target.value || 0), 0, 600) })}
            />
          </label>
          <label>
            급여일
            <input
              type="number"
              min={1}
              max={31}
              value={settings.payday}
              onChange={(event) => updateSettings({ payday: clamp(Number(event.target.value || 1), 1, 31) })}
            />
          </label>
          <label>
            첫 출근 시간
            <input
              type="time"
              value={settings.preferredShiftStart}
              onChange={(event) => updateSettings({ preferredShiftStart: event.target.value })}
            />
          </label>
          <label>
            퇴근 예정 시간
            <input
              type="time"
              value={settings.preferredShiftEnd}
              onChange={(event) => updateSettings({ preferredShiftEnd: event.target.value })}
            />
          </label>
          <label>
            담당자 연락처
            <input value={settings.managerContact} onChange={(event) => updateSettings({ managerContact: event.target.value })} placeholder="예: 010-0000-0000" />
          </label>
        </div>

        {activePay && (
          <section className="summary-strip">
            <InfoPill label="진행 중 예상급여" value={formatCurrency(activePay.totalEstimatedPay)} />
            <InfoPill label="실제 근무시간" value={formatMinutes(activePay.minutesWorked)} />
            <InfoPill label="야간/연장" value={`${formatMinutes(activePay.nightMinutes)} / ${formatMinutes(activePay.overtimeMinutes)}`} />
          </section>
        )}

        <div className="stats-grid">
          <StatCard label="오늘 예상급여" value={formatCurrency(dashboard.today.pay)} note={todayRecords.length > 0 ? `${todayRecords.length}건 반영` : '기록이 없을 수 있습니다.'} />
          <StatCard label="이번달 예상급여" value={formatCurrency(dashboard.month.pay)} note={`${dashboard.month.count}건 반영`} />
          <StatCard label="주휴수당 참고값" value={dashboard.weeklyHolidayReference > 0 ? formatCurrency(dashboard.weeklyHolidayReference) : '조건 미충족'} note="주 15시간 이상을 기준으로 표시" />
          <StatCard label="시급" value={formatCurrency(settings.hourlyWage)} note="수정 후 자동 반영" />
        </div>

        <div className="detail-card">
          <span className="eyebrow">참고 안내</span>
          <h3>주휴수당 / 야간 / 연장</h3>
          <p className="reference-note">주휴수당, 야간근로, 연장근로 계산은 참고값입니다. 실제 적용 여부는 근무 조건과 계약 내용에 따라 달라질 수 있습니다.</p>
          <ul className="detail-list">
            <li>야간근로: 22시~06시 사이에 일한 시간만 별도 참고값으로 계산합니다.</li>
            <li>연장근로: 하루 8시간 초과분을 참고값으로 계산합니다.</li>
            <li>주휴수당: 주 15시간 이상 근무한 경우에만 참고값을 보여줍니다.</li>
          </ul>
        </div>
      </section>
    );
  }

  function renderChecklist() {
    return (
      <section className="card">
        <div className="section-head">
          <div>
            <span className="eyebrow">첫 출근</span>
            <h2>준비물과 체크리스트</h2>
          </div>
          <div className="card-actions">
            <button type="button" className="secondary-button" onClick={() => markAllChecklist(true)}>
              전체 체크
            </button>
            <button type="button" className="ghost-button" onClick={() => markAllChecklist(false)}>
              전체 해제
            </button>
          </div>
        </div>

        <div className="detail-card">
          <strong>첫 출근 전에 확인</strong>
          <p>근로계약서, 급여일, 휴게시간, 담당자 연락처, 출근 경로를 먼저 확인하세요.</p>
        </div>

        <div className="checklist">
          {checklist.map((item) => (
            <button key={item.id} type="button" className={`check-item ${item.done ? 'done' : ''}`} onClick={() => toggleChecklist(item.id)}>
              <span className="checkmark">{item.done ? '✓' : '○'}</span>
              <span className="check-body">
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
            </button>
          ))}
        </div>
        <p className="reference-note">체크한 내용은 저장됩니다. 샘플/참고 안내이며 실제 계약 조건과 다를 수 있습니다.</p>
      </section>
    );
  }

  function renderHelp() {
    return (
      <section className="card">
        <div className="section-head">
          <div>
            <span className="eyebrow">내 권리 / 도움</span>
            <h2>공식 기관 연결</h2>
          </div>
          <button type="button" className="secondary-button" onClick={() => setScreen('home')}>
            홈으로
          </button>
        </div>
        <p className="reference-note">법률상담이 아닌 참고 정보입니다. 기관명과 공식 URL만 사용합니다.</p>
        <div className="help-grid">
          {OFFICIAL_HELP_LINKS.map((link) => (
            <article key={link.id} className="help-card">
              <strong>{link.title}</strong>
              <p>{link.summary}</p>
              <a className="primary-button link-button" href={link.url} target="_blank" rel="noreferrer">
                공식 링크 열기
              </a>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderLounge() {
    return (
      <section className="card">
        <div className="section-head">
          <div>
            <span className="eyebrow">라운지</span>
            <h2>커뮤니티 / 게시</h2>
          </div>
          <button type="button" className="secondary-button" onClick={() => setScreen('home')}>
            홈으로
          </button>
        </div>
        <p className="reference-note">실제 사용자 게시글처럼 보이게 하지 않기 위해 샘플 게시글에는 명확히 표시합니다.</p>
        <div className="lounge-grid">
          <div className="lounge-list">
            {LOUNGE_POSTS.map((post) => (
              <button key={post.id} type="button" className={`lounge-post ${selectedPostId === post.id ? 'active' : ''}`} onClick={() => setSelectedPostId(post.id)}>
                <span className="post-meta">{post.isSample ? '샘플' : '게시글'}</span>
                <strong>{post.title}</strong>
                <small>{post.author}</small>
              </button>
            ))}
          </div>
          {selectedPost && (
            <article className="detail-card lounge-detail">
              <span className="eyebrow">{selectedPost.isSample ? '샘플 게시글' : '게시글'}</span>
              <h3>{selectedPost.title}</h3>
              <p>{selectedPost.body}</p>
              <div className="status-grid">
                <InfoPill label="작성자" value={selectedPost.author} />
                <InfoPill label="작성일" value={new Date(selectedPost.createdAt).toLocaleDateString('ko-KR')} />
                <InfoPill label="반응" value={`${selectedPost.likes}좋아요 · ${selectedPost.comments}댓글`} />
              </div>
            </article>
          )}
        </div>
      </section>
    );
  }

  function renderProfile() {
    return (
      <section className="card">
        <div className="section-head">
          <div>
            <span className="eyebrow">내정보</span>
            <h2>시급 / 알림 / 프로필</h2>
          </div>
          <button type="button" className="secondary-button" onClick={() => setScreen('home')}>
            홈으로
          </button>
        </div>

        <div className="grid-two">
          <label>
            프로필 이름
            <input value={settings.profileName} onChange={(event) => updateSettings({ profileName: event.target.value })} />
          </label>
          <label>
            시급
            <input type="number" value={settings.hourlyWage} onChange={(event) => updateSettings({ hourlyWage: clamp(Number(event.target.value || 0), 0, 1000000) })} />
          </label>
          <label>
            급여일
            <input type="number" min={1} max={31} value={settings.payday} onChange={(event) => updateSettings({ payday: clamp(Number(event.target.value || 1), 1, 31) })} />
          </label>
          <label>
            담당자 연락처
            <input value={settings.managerContact} onChange={(event) => updateSettings({ managerContact: event.target.value })} />
          </label>
        </div>

        <div className="detail-card">
          <strong>알림 설정</strong>
          <div className="toggle-grid">
            <Toggle label="근무 시작 알림" checked={settings.notifications.shiftReminder} onChange={(checked) => updateNotifications('shiftReminder', checked)} />
            <Toggle label="급여일 알림" checked={settings.notifications.paydayReminder} onChange={(checked) => updateNotifications('paydayReminder', checked)} />
            <Toggle label="체크리스트 알림" checked={settings.notifications.checklistReminder} onChange={(checked) => updateNotifications('checklistReminder', checked)} />
          </div>
        </div>

        <div className="stats-grid">
          <StatCard label="오늘 기록" value={`${dashboard.today.count}건`} note="저장된 근무 기록" />
          <StatCard label="이번달 기록" value={`${dashboard.month.count}건`} note="월 합계 반영" />
          <StatCard label="예상 급여" value={formatCurrency(dashboard.month.pay)} note="참고 계산" />
          <StatCard label="광고 상태" value={adStatus} note="운영 광고만 연결" />
        </div>

        <div className="card-actions">
          <button type="button" className="primary-button" onClick={() => {
            setToast('설정이 자동 저장되었습니다.');
            setMessage('내정보 설정을 저장했습니다.');
          }}>
            저장
          </button>
          <button type="button" className="secondary-button" onClick={() => openSection('records')}>
            근무기록 확인
          </button>
        </div>
      </section>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button type="button" className="ghost-button" onClick={goHome}>
          홈
        </button>
        <div className="topbar-title">
          <strong>{APP_NAME}</strong>
          <span>{message}</span>
        </div>
        <button type="button" className="ghost-button" onClick={() => (screen === 'home' ? goHome() : setScreen('home'))}>
          뒤로가기
        </button>
      </header>

      <nav className="nav-strip" aria-label="메인 메뉴">
        {NAV_ITEMS.map((item) => (
          <button key={item.screen} type="button" className={`nav-chip ${screen === item.screen ? 'active' : ''}`} onClick={() => openSection(item.screen)}>
            {item.label}
          </button>
        ))}
      </nav>

      <section className="card notice-card">
        <div className="notice-row">
          <strong>광고</strong>
          <span>{adStatus}</span>
        </div>
        <p>운영용 광고만 연결하며, 테스트 광고는 사용하지 않습니다. 실제 값이 없으면 검토가 필요한 상태로 표시합니다.</p>
      </section>

      {toast && (
        <section className="card toast-card" onAnimationEnd={() => setToast('')}>
          <p>{toast}</p>
        </section>
      )}

      {screen === 'home' && renderHome()}
      {screen === 'records' && renderRecords()}
      {screen === 'pay' && renderPay()}
      {screen === 'checklist' && renderChecklist()}
      {screen === 'help' && renderHelp()}
      {screen === 'lounge' && renderLounge()}
      {screen === 'profile' && renderProfile()}

      <footer className="bottom-bar">
        <button type="button" className="ghost-button" onClick={goHome}>
          홈
        </button>
        <button type="button" className="ghost-button" onClick={() => (screen === 'home' ? goHome() : setScreen('home'))}>
          뒤로가기
        </button>
      </footer>
    </main>
  );
}

function DashboardCard({
  title,
  subtitle,
  onOpen,
  children
}: {
  title: string;
  subtitle: string;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className="dashboard-card">
      <div className="section-head">
        <div>
          <span className="eyebrow">{subtitle}</span>
          <h3>{title}</h3>
        </div>
        <button type="button" className="secondary-button" onClick={onOpen}>
          상세보기
        </button>
      </div>
      <div className="dashboard-body">{children}</div>
    </article>
  );
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <article className="info-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" className={`toggle ${checked ? 'checked' : ''}`} onClick={() => onChange(!checked)} aria-pressed={checked}>
      <span>{label}</span>
      <strong>{checked ? 'ON' : 'OFF'}</strong>
    </button>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  );
}
