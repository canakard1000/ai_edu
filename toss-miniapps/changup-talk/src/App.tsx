import React, { useEffect, useMemo, useRef, useState } from 'react';
import { calculateStartupAnalysis, buildAlternativeRecommendations } from './calculation';
import { INDUSTRY_GROUPS, INDUSTRY_PROFILES, getIndustriesByGroup } from './data/industries';
import { BRAND_CATEGORY_GROUPS } from './data/brands';
import { getCommercialAreaHints, getNeighborhoodHints, getRegionHints, REGION_PROVINCES } from './data/regions';
import { APP_ENV } from './services/config';
import { inferBrandCategory, resolveBrandComparison, resolveBrandRecord } from './services/brands';
import { getRemainingAnalyses, getUsageSnapshot, grantAnalysisPass, recordAnalysisUse } from './services/usage';
import type {
  AnalysisResult,
  BrandCategory,
  BrandComparisonRow,
  BrandRecord,
  ComparisonResult,
  RecommendationCandidate,
  StartupInputs,
} from './types/startup';
import { formatCompactWon, formatDelta, formatMonths, formatPercent, formatScore, formatWon } from './utils/currency';
import './styles.css';

type Screen = 'home' | 'analysis' | 'search' | 'compare' | 'brand';
type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const STEP_TITLES = ['지역', '창업형태', '업종', '면적', '보유자금', '운영조건', '분석'];

const DEFAULT_INPUTS: StartupInputs = {
  province: '충청남도',
  district: '천안시',
  neighborhood: '불당동',
  commercialArea: '불당 상권',
  mode: '일반 점포',
  industryId: 'cafe',
  areaPyeong: 15,
  useCustomArea: false,
  customAreaPyeong: 15,
  availableCapital: 30000000,
  operatingStaff: 1,
  deliveryRatio: 20,
  operationHours: '오전 10시~오후 10시',
  secondaryDistrict: '천안시 두정동',
  comparisonArea: '불당동 중심상권',
  actualQuotes: {}
};

function isBelowB(grade: AnalysisResult['scoring']['grade']): boolean {
  return grade === 'C+' || grade === 'C' || grade === 'D';
}

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
        <main className="shell">
          <section className="card danger-card">
            <h1>화면을 다시 불러올 수 없었습니다.</h1>
            <p>{this.state.message || '예기치 않은 오류가 발생했습니다.'}</p>
            <button className="primary-button" type="button" onClick={() => window.location.reload()}>
              다시 시도
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [step, setStep] = useState<WizardStep>(0);
  const [inputs, setInputs] = useState<StartupInputs>(DEFAULT_INPUTS);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationCandidate[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [usage, setUsage] = useState(() => getUsageSnapshot());
  const [brandCategory, setBrandCategory] = useState<BrandCategory>('카페');
  const [brandRecords, setBrandRecords] = useState<BrandRecord[]>([]);
  const [brandComparison, setBrandComparison] = useState<BrandComparisonRow[]>([]);
  const [brandSelected, setBrandSelected] = useState<BrandRecord | null>(null);
  const [brandStatus, setBrandStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('모바일 우선 레이아웃으로 준비되었습니다.');
  const latestInputsRef = useRef(inputs);
  const latestRouteRef = useRef({ screen, step });
  const lastUsageKeyRef = useRef('');

  const selectedProfile = useMemo(
    () => INDUSTRY_PROFILES.find((profile) => profile.id === inputs.industryId) ?? INDUSTRY_PROFILES[0],
    [inputs.industryId]
  );
  const visibleProfiles = useMemo(() => getIndustriesByGroup(inputs.mode), [inputs.mode]);
  const regionHints = useMemo(() => getRegionHints(inputs.province), [inputs.province]);
  const neighborhoodHints = useMemo(() => getNeighborhoodHints(inputs.province, inputs.district), [inputs.province, inputs.district]);
  const areaHints = useMemo(() => getCommercialAreaHints(inputs.province, inputs.district), [inputs.province, inputs.district]);

  useEffect(() => {
    latestInputsRef.current = inputs;
  }, [inputs]);

  useEffect(() => {
    latestRouteRef.current = { screen, step };
  }, [screen, step]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const nextState = event.state as { screen?: Screen; step?: WizardStep; inputs?: StartupInputs } | null;
      if (nextState?.screen) {
        setScreen(nextState.screen);
        setStep(nextState.step ?? 0);
        if (nextState.inputs) {
          setInputs(nextState.inputs);
        }
        return;
      }

      setScreen('home');
      setStep(0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    window.history.replaceState({ ...latestRouteRef.current, inputs }, '', window.location.pathname + window.location.search);
  }, [inputs]);

  useEffect(() => {
    window.history.pushState({ screen, step, inputs: latestInputsRef.current }, '', window.location.pathname + window.location.search);
  }, [screen, step]);

  useEffect(() => {
    if (screen !== 'analysis') {
      return;
    }

    let cancelled = false;
    setStatus('loading');
    const usageKey = JSON.stringify({
      province: inputs.province,
      district: inputs.district,
      neighborhood: inputs.neighborhood,
      area: inputs.areaPyeong,
      industryId: inputs.industryId,
      mode: inputs.mode,
      capital: inputs.availableCapital,
      quotes: inputs.actualQuotes
    });
    if (usageKey !== lastUsageKeyRef.current) {
      lastUsageKeyRef.current = usageKey;
      setUsage((current) => recordAnalysisUse(current));
    }

    (async () => {
      try {
        const nextAnalysis = await calculateStartupAnalysis(inputs, selectedProfile);
        if (cancelled) return;
        setAnalysis(nextAnalysis);
        setRecommendations(
          isBelowB(nextAnalysis.scoring.grade)
            ? await buildAlternativeRecommendations(inputs, selectedProfile)
            : []
        );
        setStatus('ready');
        setMessage(`분석 완료 · 신뢰도 ${nextAnalysis.confidence.overall}/100`);
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inputs, screen, selectedProfile]);

  useEffect(() => {
    if (screen !== 'search') {
      return;
    }

    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        const nextRecommendations = await buildAlternativeRecommendations(inputs, selectedProfile);
        if (cancelled) return;
        setRecommendations(nextRecommendations);
        setAnalysis(nextRecommendations[0]?.analysis ?? null);
        setStatus('ready');
        setMessage('보유자금 기준으로 추천 후보를 정렬했습니다.');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : '추천 분석 중 오류가 발생했습니다.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inputs, screen, selectedProfile]);

  useEffect(() => {
    if (screen !== 'compare') {
      return;
    }

    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        const leftInputs = { ...inputs, commercialArea: inputs.comparisonArea };
        const rightInputs = { ...inputs, district: inputs.secondaryDistrict, neighborhood: inputs.secondaryDistrict, commercialArea: `${inputs.secondaryDistrict} 상권` };
        const [left, right] = await Promise.all([
          calculateStartupAnalysis(leftInputs, selectedProfile),
          calculateStartupAnalysis(rightInputs, selectedProfile)
        ]);
        if (cancelled) return;
        setComparison({
          left,
          right,
          deltas: {
            deposit: right.breakdown.deposit - left.breakdown.deposit,
            monthlyRent: right.breakdown.monthlyRent - left.breakdown.monthlyRent,
            totalInvestment: right.breakdown.totalInvestment - left.breakdown.totalInvestment,
            competitorCount: right.context.competitorExamples.length - left.context.competitorExamples.length,
            expectedSales: right.breakdown.expectedSales - left.breakdown.expectedSales,
            breakEvenSales: right.breakdown.breakEvenSales - left.breakdown.breakEvenSales,
            operatingProfit: right.breakdown.operatingProfit - left.breakdown.operatingProfit,
            paybackMonths: (right.breakdown.paybackMonths ?? 0) - (left.breakdown.paybackMonths ?? 0),
            scoring: right.scoring.score - left.scoring.score
          }
        });
        setStatus('ready');
        setMessage('지역 비교 완료');
      } catch (error) {
        if (cancelled) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : '지역 비교 중 오류가 발생했습니다.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inputs, screen, selectedProfile]);

  useEffect(() => {
    if (screen !== 'brand') {
      return;
    }

    let cancelled = false;
    setBrandStatus('loading');
    setBrandSelected(null);
    setBrandRecords([]);
    setBrandComparison([]);

    const categoryGroup = BRAND_CATEGORY_GROUPS.find((item) => item.category === brandCategory) ?? BRAND_CATEGORY_GROUPS[0];
    const profiles = categoryGroup.profileIds
      .map((profileId) => INDUSTRY_PROFILES.find((profile) => profile.id === profileId))
      .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));

    if (profiles.length === 0) {
      setBrandStatus('error');
      setMessage('브랜드 카테고리 데이터가 아직 비어 있습니다.');
      return;
    }

    (async () => {
      try {
        const details = await Promise.all(profiles.map(async (profile) => resolveBrandRecord(profile)));
        const comparisonRows = await resolveBrandComparison(profiles.slice(0, 3), inputs.availableCapital);
        if (cancelled) return;
        setBrandRecords(details);
        setBrandComparison(comparisonRows);
        setBrandSelected((current) => current ?? details[0] ?? null);
        setBrandStatus('ready');
        setMessage(`${brandCategory} 브랜드 탐색을 불러왔습니다.`);
      } catch (error) {
        if (cancelled) return;
        setBrandStatus('error');
        setMessage(error instanceof Error ? error.message : '브랜드 탐색 중 오류가 발생했습니다.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [brandCategory, inputs.availableCapital, screen]);

  function updateInput<K extends keyof StartupInputs>(key: K, value: StartupInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  function navigate(nextScreen: Screen, nextStep: WizardStep = 0) {
    setScreen(nextScreen);
    setStep(nextStep);
    setMessage(nextScreen === 'home' ? '홈으로 돌아왔습니다.' : '선택한 화면으로 이동했습니다.');
  }

  function prevStep() {
    if (step === 0) {
      navigate('home', 0);
      return;
    }

    setStep((current) => Math.max(0, current - 1) as WizardStep);
  }

  async function shareCurrentView() {
    const text = analysis
      ? `${APP_ENV.appName} ${analysis.profile.name} 분석: ${formatCompactWon(analysis.costBand.totalInvestment.base)} 기준`
      : `${APP_ENV.appName} - ${inputs.province} ${inputs.district}`;

    const payload = {
      title: APP_ENV.appName,
      text,
      url: APP_ENV.baseUrl
    };

    try {
      if (navigator.share) {
        await navigator.share(payload);
        setMessage('공유를 열었습니다.');
        return;
      }

      await navigator.clipboard.writeText(`${payload.title}\n${payload.text}\n${payload.url}`);
      setMessage('공유 링크를 클립보드에 복사했습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '공유에 실패했습니다.');
    }
  }

  function onAnalyze() {
    navigate('analysis', 0);
  }

  function onSearch() {
    navigate('search', 0);
  }

  function onCompare() {
    navigate('compare', 0);
  }

  function onBrandBrowse(category?: BrandCategory) {
    if (category) {
      setBrandCategory(category);
    }
    navigate('brand', 0);
  }

  function onHome() {
    navigate('home', 0);
  }

  function choosePresetArea(area: number) {
    setInputs((current) => ({ ...current, areaPyeong: area, customAreaPyeong: area, useCustomArea: false }));
  }

  function updateActualQuote(key: keyof StartupInputs['actualQuotes'], value: number | undefined) {
    setInputs((current) => ({
      ...current,
      actualQuotes: {
        ...current.actualQuotes,
        [key]: value
      }
    }));
  }

  function renderEntitlementCard() {
    const remaining = getRemainingAnalyses(usage);
    const hasPaidPass = usage.purchasedPasses - usage.purchasedUsed > 0;

    return (
      <section className="card">
        <span className="eyebrow">정밀분석 이용권</span>
        <h2>무료 1회 사용 후에는 이용권이 필요합니다.</h2>
        <p>
          현재 남은 정밀분석 횟수는 <strong>{remaining}</strong>회입니다.
          {hasPaidPass ? ' 구매한 이용권이 남아 있습니다.' : ' 구매한 이용권은 아직 없습니다.'}
        </p>
        <div className="grid two-col">
          <article className="mini-plan">
            <strong>정밀분석 3회</strong>
            <span>1,000원</span>
            <p>실제 결제는 아직 연결하지 않았습니다.</p>
          </article>
          <article className="mini-plan">
            <strong>정밀분석 20회</strong>
            <span>가격 미확정</span>
            <p>향후 운영용 상품 ID를 환경변수로만 연결합니다.</p>
          </article>
        </div>
        {import.meta.env.DEV ? (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              const next = grantAnalysisPass('ANALYSIS_3', 3);
              setUsage(next);
              setMessage('개발모드 미리보기로 이용권이 추가되었습니다.');
            }}
          >
            [개발모드] 이용권 미리보기
          </button>
        ) : (
          <p className="mock-label">운영 앱에서는 가짜 결제 성공을 만들지 않습니다.</p>
        )}
      </section>
    );
  }

  function renderAnalysisHeader() {
    if (!analysis) {
      return null;
    }

    const sourceLine = `${analysis.sourceMeta.label} · ${analysis.sourceMeta.isEstimated ? '추정값' : '실데이터'} · 기준일 ${analysis.sourceMeta.basisDate}`;

    return (
      <section className="card summary-header">
        <div>
          <span className="eyebrow">현재 선택</span>
          <h2>
            {inputs.province} {inputs.district} · {selectedProfile.name}
          </h2>
          <p>{sourceLine}</p>
        </div>
        <div className="summary-actions">
          <button className="secondary-button" type="button" onClick={shareCurrentView}>
            공유
          </button>
          <button className="secondary-button" type="button" onClick={() => setInputs((current) => ({ ...current }))}>
            다시 계산
          </button>
          {isBelowB(analysis.scoring.grade) && (
            <button
              className="primary-button"
              type="button"
              onClick={() => onBrandBrowse(inferBrandCategory(analysis.profile))}
            >
              추천 업종의 창업 브랜드 보기
            </button>
          )}
        </div>
      </section>
    );
  }

  function renderWizardStep() {
    if (step === 0) {
      return (
        <section className="card">
          <h2>STEP 1 지역</h2>
          <div className="grid two-col">
            <label>
              시/도
              <select value={inputs.province} onChange={(event) => updateInput('province', event.target.value)}>
                {REGION_PROVINCES.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </label>
            <label>
              시/군/구
              <input value={inputs.district} list="district-hints" onChange={(event) => updateInput('district', event.target.value)} placeholder="예: 천안시" />
              <datalist id="district-hints">
                {regionHints.map((hint) => (
                  <option key={hint} value={hint} />
                ))}
              </datalist>
            </label>
            <label>
              읍/면/동
              <input
                value={inputs.neighborhood}
                list="neighborhood-hints"
                onChange={(event) => updateInput('neighborhood', event.target.value)}
                placeholder="예: 불당동"
              />
              <datalist id="neighborhood-hints">
                {neighborhoodHints.map((hint) => (
                  <option key={hint} value={hint} />
                ))}
              </datalist>
            </label>
            <label>
              상권 이름
              <input
                value={inputs.commercialArea}
                list="area-hints"
                onChange={(event) => updateInput('commercialArea', event.target.value)}
                placeholder="예: 불당 상권"
              />
              <datalist id="area-hints">
                {areaHints.map((hint) => (
                  <option key={hint} value={hint} />
                ))}
              </datalist>
            </label>
          </div>
          <div className="hint-box">전국 확장형 모델로 설계되어 있으며, 지역 데이터는 시도 → 시군구 → 읍면동 순으로 세분화됩니다.</div>
        </section>
      );
    }

    if (step === 1) {
      return (
        <section className="card">
          <h2>STEP 2 창업형태</h2>
          <div className="group-grid">
            {INDUSTRY_GROUPS.map((group) => (
              <button
                type="button"
                key={group.id}
                className={`chip-card ${inputs.mode === group.id ? 'active' : ''}`}
                onClick={() => {
                  updateInput('mode', group.id);
                  const firstItem = getIndustriesByGroup(group.id)[0];
                  if (firstItem) {
                    updateInput('industryId', firstItem.id);
                  }
                }}
              >
                <strong>{group.title}</strong>
                <span>{group.description}</span>
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (step === 2) {
      return (
        <section className="card">
          <h2>STEP 3 업종</h2>
          <div className="industry-grid">
            {visibleProfiles.map((profile) => (
              <button
                type="button"
                key={profile.id}
                className={`industry-card ${inputs.industryId === profile.id ? 'active' : ''}`}
                onClick={() => updateInput('industryId', profile.id)}
              >
                <strong>{profile.name}</strong>
                <span>{profile.summary}</span>
                <small>권장 {profile.recommendedAreas.join('/')}평 · 최소자금 {formatCompactWon(profile.minCapital)}</small>
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (step === 3) {
      const area = inputs.useCustomArea ? inputs.customAreaPyeong : inputs.areaPyeong;

      return (
        <section className="card">
          <h2>STEP 4 면적</h2>
          <div className="area-grid">
            {[5, 10, 15, 20, 30].map((value) => (
              <button
                type="button"
                key={value}
                className={`area-pill ${!inputs.useCustomArea && area === value ? 'active' : ''}`}
                onClick={() => choosePresetArea(value)}
              >
                {value}평
              </button>
            ))}
          </div>
          <label>
            직접입력
            <input
              type="number"
              min={1}
              value={inputs.customAreaPyeong}
              onChange={(event) =>
                setInputs((current) => ({
                  ...current,
                  useCustomArea: true,
                  customAreaPyeong: Number(event.target.value || 0)
                }))
              }
              placeholder="예: 12"
            />
          </label>
          <div className="hint-box">
            {selectedProfile.recommendedAreas.includes(area)
              ? `${selectedProfile.name}는 현재 면적과 잘 맞는 편입니다.`
              : `${selectedProfile.name}는 ${selectedProfile.recommendedAreas.join(', ')}평 구간을 우선 검토하면 좋습니다.`}
          </div>
        </section>
      );
    }

    if (step === 4) {
      return (
        <section className="card">
          <h2>STEP 5 보유자금</h2>
          <div className="grid two-col">
            <label>
              보유자금
              <input
                type="number"
                min={0}
                step={1000000}
                value={inputs.availableCapital}
                onChange={(event) => updateInput('availableCapital', Number(event.target.value))}
              />
            </label>
            <label>
              운영 인원
              <select value={inputs.operatingStaff} onChange={(event) => updateInput('operatingStaff', Number(event.target.value))}>
                <option value={0}>0명</option>
                <option value={1}>1명</option>
                <option value={2}>2명</option>
                <option value={3}>3명</option>
                <option value={4}>4명 이상</option>
              </select>
            </label>
          </div>
          <div className="hint-box">보유자금과 운영 인원은 추천 순위와 회수기간에 직접 반영됩니다.</div>
        </section>
      );
    }

    if (step === 5) {
      return (
        <section className="card">
          <h2>STEP 6 운영조건</h2>
          <div className="grid two-col">
            <label>
              운영 시간
              <select value={inputs.operationHours} onChange={(event) => updateInput('operationHours', event.target.value)}>
                <option value="오전 10시~오후 10시">오전 10시~오후 10시</option>
                <option value="오전 11시~오후 11시">오전 11시~오후 11시</option>
                <option value="24시간">24시간</option>
              </select>
            </label>
            <label>
              배달 비중
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={inputs.deliveryRatio}
                onChange={(event) => updateInput('deliveryRatio', Number(event.target.value))}
              />
              <span className="range-label">{inputs.deliveryRatio}%</span>
            </label>
          </div>

          <details className="hint-box" open>
            <summary>실제 견적 입력</summary>
            <div className="grid two-col" style={{ marginTop: 12 }}>
              <label>
                실제 보증금
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={inputs.actualQuotes.actualDeposit ?? ''}
                  onChange={(event) => updateActualQuote('actualDeposit', event.target.value === '' ? undefined : Number(event.target.value))}
                />
              </label>
              <label>
                실제 월세
                <input
                  type="number"
                  min={0}
                  step={50000}
                  value={inputs.actualQuotes.actualMonthlyRent ?? ''}
                  onChange={(event) => updateActualQuote('actualMonthlyRent', event.target.value === '' ? undefined : Number(event.target.value))}
                />
              </label>
              <label>
                실제 권리금
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={inputs.actualQuotes.actualPremium ?? ''}
                  onChange={(event) => updateActualQuote('actualPremium', event.target.value === '' ? undefined : Number(event.target.value))}
                />
              </label>
              <label>
                인테리어 견적
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={inputs.actualQuotes.actualInteriorCost ?? ''}
                  onChange={(event) => updateActualQuote('actualInteriorCost', event.target.value === '' ? undefined : Number(event.target.value))}
                />
              </label>
              <label>
                장비 견적
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={inputs.actualQuotes.actualEquipmentCost ?? ''}
                  onChange={(event) => updateActualQuote('actualEquipmentCost', event.target.value === '' ? undefined : Number(event.target.value))}
                />
              </label>
              <label>
                예상 직원 수
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={inputs.actualQuotes.actualStaffCount ?? ''}
                  onChange={(event) => updateActualQuote('actualStaffCount', event.target.value === '' ? undefined : Number(event.target.value))}
                />
              </label>
              <label>
                예상 인건비
                <input
                  type="number"
                  min={0}
                  step={100000}
                  value={inputs.actualQuotes.actualLaborCost ?? ''}
                  onChange={(event) => updateActualQuote('actualLaborCost', event.target.value === '' ? undefined : Number(event.target.value))}
                />
              </label>
            </div>
          </details>
        </section>
      );
    }

    if (!analysis) {
      return (
        <section className="card">
          <h2>STEP 7 분석</h2>
          <p className="status-text">{status === 'loading' ? '분석 값을 계산하는 중입니다...' : '분석을 실행하면 결과가 표시됩니다.'}</p>
          {status === 'error' && <p className="status-text error">{message}</p>}
        </section>
      );
    }

    const sourceLine = `${analysis.sourceMeta.label} · ${analysis.sourceMeta.source.toUpperCase()} · ${analysis.sourceMeta.isEstimated ? '추정값' : '실데이터'}`;

    return (
      <section className="card">
        <h2>STEP 7 분석</h2>
        {status === 'loading' && <p className="status-text">분석 값을 계산하는 중입니다...</p>}
        {status === 'error' && <p className="status-text error">{message}</p>}
        {status === 'ready' && (
          <>
            <div className="summary-hero">
              <div>
                <span className="eyebrow">총 예상 창업비</span>
                <strong>{formatCompactWon(analysis.costBand.totalInvestment.base)}</strong>
                <p>
                  {formatCompactWon(analysis.costBand.totalInvestment.min)}~{formatCompactWon(analysis.costBand.totalInvestment.max)}
                </p>
              </div>
              <div>
                <span className="eyebrow">보유자금과 차이</span>
                <strong className={analysis.capitalGap >= 0 ? 'positive' : 'negative'}>{formatDelta(analysis.capitalGap)}</strong>
                <p>{analysis.capitalGap >= 0 ? '보유자금이 충분합니다.' : '보유자금이 부족합니다.'}</p>
              </div>
            </div>
            <div className="metric-grid">
              <Metric label="예상 보증금" value={`${formatCompactWon(analysis.costBand.deposit.min)}~${formatCompactWon(analysis.costBand.deposit.max)}`} />
              <Metric label="예상 월세" value={`${formatCompactWon(analysis.costBand.monthlyRent.min)}~${formatCompactWon(analysis.costBand.monthlyRent.max)}`} />
              <Metric label="권리금" value={analysis.breakdown.premium > 0 ? formatWon(analysis.breakdown.premium) : '데이터 없음'} />
              <Metric label="상권 적합도" value={`${analysis.scoring.grade} · ${formatScore(analysis.scoring.score)}`} />
              <Metric label="예상 월매출" value={`${formatCompactWon(analysis.salesBand.min)}~${formatCompactWon(analysis.salesBand.max)}`} />
              <Metric label="손익분기 매출" value={formatWon(analysis.breakdown.breakEvenSales)} />
              <Metric label="예상 월 영업이익" value={formatWon(analysis.breakdown.operatingProfit)} />
              <Metric label="투자금 회수기간" value={formatMonths(analysis.breakdown.paybackMonths)} />
            </div>
            <div className="subsection">
              <h3>데이터 출처</h3>
              <p className="mock-label">{sourceLine}</p>
              <ul className="list compact">
                {analysis.dataTrace.map((trace) => (
                  <li key={`${trace.label}-${trace.source}`}>
                    <strong>{trace.label}</strong>
                    <span>
                      {trace.source.toUpperCase()} · 기준일 {trace.basisDate} · {trace.isEstimated ? '추정값' : '실데이터'} · 신뢰도 {trace.reliability}/100
                    </span>
                    <span>{trace.details}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="subsection">
              <h3>분석 신뢰도 {analysis.confidence.overall}/100</h3>
              <p className="mock-label">임대 {analysis.confidence.rent} · 경쟁 {analysis.confidence.competition} · 수요 {analysis.confidence.demand} · 창업비 {analysis.confidence.startupCost} · 매출 {analysis.confidence.salesForecast}</p>
              <details className="hint-box">
                <summary>왜 이 점수인가요?</summary>
                <ul className="list compact" style={{ marginTop: 12 }}>
                  {analysis.confidence.reasonSummary.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </details>
            </div>
            <div className="subsection">
              <h3>상권 적합도 근거</h3>
              <ul className="list">
                {analysis.scoring.factors.map((factor) => (
                  <li key={factor.label}>
                    <strong>{factor.label}</strong> {formatScore(factor.score)} · 가중치 {(factor.weight * 100).toFixed(0)}%
                    <span>{factor.explanation}</span>
                  </li>
                ))}
              </ul>
              {analysis.scoring.warnings.length > 0 && (
                <div className="warn-box">
                  {analysis.scoring.warnings.map((warning) => (
                    <p key={warning}>{warning}</p>
                  ))}
                </div>
              )}
            </div>
            <div className="subsection">
              <h3>3개 시나리오</h3>
              <div className="scenario-grid">
                {analysis.scenarios.map((scenario) => (
                  <article key={scenario.label} className="scenario-card">
                    <strong>{scenario.label}</strong>
                    <p>예상 매출 {formatWon(scenario.sales)}</p>
                    <p>예상 비용 {formatWon(scenario.totalCost)}</p>
                    <p>예상 영업이익 {formatWon(scenario.operatingProfit)}</p>
                    <p>BEP 대비 여유율 {formatPercent(scenario.breakEvenBufferRate)}</p>
                    <p>회수기간 {formatMonths(scenario.paybackMonths)}</p>
                    <p>현금흐름 {formatWon(scenario.cashFlow)}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="subsection">
              <h3>장사가 예상보다 안되면?</h3>
              <div className="scenario-grid">
                {analysis.stressTests.map((scenario) => (
                  <article key={scenario.label} className="scenario-card">
                    <strong>{scenario.label}</strong>
                    <p>매출 {formatWon(scenario.sales)}</p>
                    <p>영업이익 {formatWon(scenario.operatingProfit)}</p>
                    <p>BEP {formatWon(scenario.breakEvenSales)}</p>
                    <p>현금흐름 {formatWon(scenario.cashFlow)}</p>
                    <p>회수기간 {formatMonths(scenario.paybackMonths)}</p>
                  </article>
                ))}
              </div>
            </div>
            <div className="subsection">
              <h3>주변 경쟁업체</h3>
              <ul className="list compact">
                {analysis.context.competitorExamples.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="subsection">
              <h3>주요 위험요인</h3>
              <ul className="list compact">
                {analysis.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </div>
            <div className="subsection">
              <h3>개선 제안</h3>
              <ul className="list compact">
                {analysis.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </div>
            {isBelowB(analysis.scoring.grade) && recommendations.length > 0 && (
              <div className="subsection">
                <h3>이 지역에서 더 유리한 창업 찾아보기</h3>
                <p className="mock-label">현재 보유자금과 지역을 그대로 유지한 TOP 5 추천입니다.</p>
                <div className="candidate-list">
                  {recommendations.map((candidate, index) => (
                    <article key={candidate.profile.id} className="candidate-card">
                      <strong>추천 {index + 1}위 · {candidate.profile.name}</strong>
                      <p>적합도 {candidate.analysis.scoring.grade} · 필요자금 {formatCompactWon(candidate.analysis.costBand.totalInvestment.min)}~{formatCompactWon(candidate.analysis.costBand.totalInvestment.max)}</p>
                      <p>예상 BEP {formatWon(candidate.analysis.breakdown.breakEvenSales)} · 1인 운영 {candidate.analysis.profile.requiredStaff <= 1 ? '적합' : '주의'}</p>
                      <p>분석 신뢰도 {candidate.analysis.confidence.overall}/100</p>
                      <p>추천 이유: {candidate.reasons.join(' ')}</p>
                      <p className="candidate-note">{candidate.suitabilityNote}</p>
                    </article>
                  ))}
                </div>
              </div>
            )}
            <div className="subsection">
              <h3>법적/서비스 고지</h3>
              <p className="disclaimer">
                본 분석은 공개 데이터와 입력 조건을 기반으로 한 예상치이며 실제 임대료, 매출, 공사비 및 사업 성과와 차이가 발생할 수 있습니다.
              </p>
              <p className="mock-label">{analysis.affiliateNotice}</p>
              <p className="mock-label">{analysis.sourceMeta.details}</p>
            </div>
          </>
        )}
      </section>
    );
  }

  function renderSearch() {
    return (
      <section className="card">
        <h2>내 돈으로 가능한 창업 찾기</h2>
        <p>보유자금과 지역을 기준으로 시작 가능성이 높은 업종 후보를 정렬했습니다.</p>
        <div className="metric-grid compact">
          <Metric label="보유자금" value={formatWon(inputs.availableCapital)} />
          <Metric label="지역" value={`${inputs.province} ${inputs.district}`} />
          <Metric label="운영 인원" value={`${inputs.operatingStaff}명`} />
          <Metric label="배달 비중" value={`${inputs.deliveryRatio}%`} />
        </div>
        <div className="candidate-list">
          {recommendations.map((candidate, index) => (
            <article key={candidate.profile.id} className="candidate-card">
              <strong>추천 {index + 1}위 · {candidate.profile.name}</strong>
              <p>{candidate.profile.summary}</p>
              <div className="candidate-metrics">
                <span>필요자금 {formatCompactWon(candidate.analysis.costBand.totalInvestment.min)}~{formatCompactWon(candidate.analysis.costBand.totalInvestment.max)}</span>
                <span>예상 고정비 {formatWon(candidate.analysis.breakdown.monthlyFixedCost)}</span>
                <span>운영난이도 {candidate.analysis.profile.operationalComplexity}/100</span>
                <span>상권 적합도 {candidate.analysis.scoring.grade}</span>
                <span>1인 운영 {candidate.analysis.profile.requiredStaff <= 1 ? '가능' : '주의'}</span>
                <span>BEP {formatWon(candidate.analysis.breakdown.breakEvenSales)}</span>
              </div>
              <p className="candidate-note">{candidate.reasons.join(' ')}</p>
            </article>
          ))}
        </div>
      </section>
    );
  }

  function renderBrand() {
    const categoryGroup = BRAND_CATEGORY_GROUPS.find((item) => item.category === brandCategory) ?? BRAND_CATEGORY_GROUPS[0];
    const remaining = getRemainingAnalyses(usage);

    return (
      <section className="card">
        <h2>창업 브랜드 찾아보기</h2>
        <p>공정위 실데이터가 연결되는 브랜드만 숫자를 보여주고, 제휴/광고 표시는 별도로 분리합니다.</p>
        {brandStatus === 'loading' && <p className="status-text">브랜드 데이터를 불러오는 중입니다...</p>}
        {brandStatus === 'error' && <p className="status-text error">브랜드 데이터를 불러오지 못했습니다.</p>}
        <div className="stepper">
          {BRAND_CATEGORY_GROUPS.map((group) => (
            <button
              key={group.category}
              type="button"
              className={`step-chip ${brandCategory === group.category ? 'active' : ''}`}
              onClick={() => setBrandCategory(group.category)}
            >
              {group.title}
            </button>
          ))}
        </div>
        <div className="hint-box">{categoryGroup.description}</div>
        <div className="metric-grid compact">
          <Metric label="남은 정밀분석" value={`${remaining}회`} />
          <Metric label="무료/구매" value={`${usage.freeUsed}/${usage.freeLimit} · ${usage.purchasedUsed}/${usage.purchasedPasses}`} />
          <Metric label="브랜드 비교" value={`${brandComparison.length}개`} />
          <Metric label="제휴 상태" value="실제 계약 전 미표시" />
        </div>
        <div className="candidate-list">
          {brandRecords.map((record) => (
            <article
              key={record.brandId}
              className={`candidate-card ${brandSelected?.brandId === record.brandId ? 'selected' : ''}`}
              onClick={() => setBrandSelected(record)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  setBrandSelected(record);
                }
              }}
            >
              <strong>{record.brandName}</strong>
              <p>{record.industryName} · {record.category}</p>
              <div className="candidate-metrics">
                <span>{record.sourceMeta.source.toUpperCase()}</span>
                <span>{record.sourceMeta.isEstimated ? '추정' : '실데이터'}</span>
                <span>기준일 {record.sourceMeta.basisDate}</span>
                <span>신뢰도 {record.sourceMeta.reliability}/100</span>
                <span>{record.isPartner ? record.partnershipType : '비제휴'}</span>
              </div>
              <p className="candidate-note">{record.note}</p>
            </article>
          ))}
        </div>
        {brandSelected && (
          <article className="card brand-detail-card">
            <span className="eyebrow">브랜드 상세</span>
            <h3>{brandSelected.brandName}</h3>
            <p>{brandSelected.industryName} · {brandSelected.category}</p>
            <div className="grid two-col">
              <div className="mini-plan">
                <strong>가맹비</strong>
                <span>{brandSelected.franchiseFee === null ? '데이터 없음' : formatWon(brandSelected.franchiseFee)}</span>
              </div>
              <div className="mini-plan">
                <strong>교육비</strong>
                <span>{brandSelected.educationFee === null ? '데이터 없음' : formatWon(brandSelected.educationFee)}</span>
              </div>
              <div className="mini-plan">
                <strong>보증금</strong>
                <span>{brandSelected.deposit === null ? '데이터 없음' : formatWon(brandSelected.deposit)}</span>
              </div>
              <div className="mini-plan">
                <strong>기타비용</strong>
                <span>{brandSelected.otherCost === null ? '데이터 없음' : formatWon(brandSelected.otherCost)}</span>
              </div>
            </div>
            <p>총 초기비용 {brandSelected.totalStartupCost ? `${formatWon(brandSelected.totalStartupCost.min)}~${formatWon(brandSelected.totalStartupCost.max)} · 기준 ${formatWon(brandSelected.totalStartupCost.base)}` : '데이터 없음'}</p>
            <p>제휴 상태 {brandSelected.isPartner ? brandSelected.partnershipType : '비제휴'}</p>
            <p>데이터 출처 {brandSelected.sourceMeta.label} · 기준일 {brandSelected.sourceMeta.basisDate}</p>
            <p className="mock-label">{brandSelected.note}</p>
          </article>
        )}
        <div className="subsection">
          <h3>브랜드 비교</h3>
          <p className="mock-label">최대 3개 브랜드를 비교합니다.</p>
          <div className="comparison-grid">
            {brandComparison.map((row) => (
              <article key={row.brandId} className="comparison-card">
                <strong>{row.brandName}</strong>
                <p>가맹비 {row.fee === null ? '데이터 없음' : formatWon(row.fee)}</p>
                <p>교육비 {row.educationFee === null ? '데이터 없음' : formatWon(row.educationFee)}</p>
                <p>보증금 {row.deposit === null ? '데이터 없음' : formatWon(row.deposit)}</p>
                <p>기타비용 {row.otherCost === null ? '데이터 없음' : formatWon(row.otherCost)}</p>
                <p>총 초기비용 {row.totalStartupCost === null ? '데이터 없음' : formatWon(row.totalStartupCost)}</p>
                <p>보유자금 차이 {formatDelta(row.capitalGap)}</p>
                <p>제휴 상태 {row.isPartner ? row.partnershipType : '비제휴'}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  function renderCompare() {
    if (!comparison) {
      return (
        <section className="card">
          <h2>지역 비교</h2>
          <p className="status-text">{status === 'loading' ? '비교 분석 중입니다...' : '비교할 지역을 입력한 뒤 분석하세요.'}</p>
        </section>
      );
    }

    return (
      <section className="card">
        <h2>지역 비교</h2>
        <p>같은 업종을 두 지역에서 비교합니다.</p>
        <div className="grid two-col">
          <label>
            비교 지역 1
            <input value={inputs.comparisonArea} onChange={(event) => updateInput('comparisonArea', event.target.value)} />
          </label>
          <label>
            비교 지역 2
            <input value={inputs.secondaryDistrict} onChange={(event) => updateInput('secondaryDistrict', event.target.value)} />
          </label>
        </div>
        <div className="comparison-grid">
          <article className="comparison-card">
            <strong>{comparison.left.context.district}</strong>
            <p>보증금 {formatWon(comparison.left.breakdown.deposit)}</p>
            <p>월세 {formatWon(comparison.left.breakdown.monthlyRent)}</p>
            <p>총 투자비 {formatWon(comparison.left.costBand.totalInvestment.base)}</p>
            <p>경쟁점포 {comparison.left.context.competitorExamples.length}곳</p>
            <p>예상매출 {formatWon(comparison.left.breakdown.expectedSales)}</p>
            <p>BEP {formatWon(comparison.left.breakdown.breakEvenSales)}</p>
            <p>예상 영업이익 {formatWon(comparison.left.breakdown.operatingProfit)}</p>
            <p>투자금 회수기간 {formatMonths(comparison.left.breakdown.paybackMonths)}</p>
            <p>상권 적합도 {comparison.left.scoring.grade}</p>
          </article>
          <article className="comparison-card">
            <strong>{comparison.right.context.district}</strong>
            <p>보증금 {formatWon(comparison.right.breakdown.deposit)}</p>
            <p>월세 {formatWon(comparison.right.breakdown.monthlyRent)}</p>
            <p>총 투자비 {formatWon(comparison.right.costBand.totalInvestment.base)}</p>
            <p>경쟁점포 {comparison.right.context.competitorExamples.length}곳</p>
            <p>예상매출 {formatWon(comparison.right.breakdown.expectedSales)}</p>
            <p>BEP {formatWon(comparison.right.breakdown.breakEvenSales)}</p>
            <p>예상 영업이익 {formatWon(comparison.right.breakdown.operatingProfit)}</p>
            <p>투자금 회수기간 {formatMonths(comparison.right.breakdown.paybackMonths)}</p>
            <p>상권 적합도 {comparison.right.scoring.grade}</p>
          </article>
        </div>
        <div className="subsection">
          <h3>비교 차이</h3>
          <ul className="list compact">
            <li>보증금 차이 {formatDelta(comparison.deltas.deposit)}</li>
            <li>월세 차이 {formatDelta(comparison.deltas.monthlyRent)}</li>
            <li>총 투자비 차이 {formatDelta(comparison.deltas.totalInvestment)}</li>
            <li>예상매출 차이 {formatDelta(comparison.deltas.expectedSales)}</li>
            <li>BEP 차이 {formatDelta(comparison.deltas.breakEvenSales)}</li>
            <li>영업이익 차이 {formatDelta(comparison.deltas.operatingProfit)}</li>
            <li>적합도 점수 차이 {comparison.deltas.scoring.toFixed(1)}</li>
          </ul>
        </div>
      </section>
    );
  }

  return (
    <AppErrorBoundary>
      <main className="shell">
        <header className="topbar">
          <button type="button" className="ghost-button" onClick={onHome}>
            홈
          </button>
          <div className="topbar-title">
            <strong>{APP_ENV.appName}</strong>
            <span>{message}</span>
          </div>
          <button type="button" className="ghost-button" onClick={prevStep}>
            뒤로
          </button>
        </header>

        <nav className="stepper" aria-label="분석 단계">
          {STEP_TITLES.map((title, index) => (
            <button
              key={title}
              type="button"
              className={`step-chip ${screen === 'analysis' && step === index ? 'active' : ''}`}
              onClick={() => navigate('analysis', index as WizardStep)}
            >
              {index + 1}. {title}
            </button>
          ))}
        </nav>

        <section className="quick-actions">
          <button type="button" className="quick-button" onClick={onAnalyze}>
            내 창업비용 분석하기
          </button>
          <button type="button" className="quick-button" onClick={onSearch}>
            내 돈으로 가능한 창업 찾기
          </button>
          <button type="button" className="quick-button" onClick={onCompare}>
            지역 비교
          </button>
          <button type="button" className="quick-button" onClick={() => onBrandBrowse()}>
            창업 브랜드 찾아보기
          </button>
        </section>

        <section className="banner-row">
          <article className="mini-banner">
            <span className="eyebrow">운영 배너</span>
            <strong>{APP_ENV.adGroupId || '운영 ID 미등록'}</strong>
            <p>실제 운영 전환 시에는 운영용 광고 ID를 환경변수로만 주입하세요. 임의 생성은 하지 않습니다.</p>
          </article>
          <article className="mini-banner">
            <span className="eyebrow">홈 복귀</span>
            <strong>모바일 뒤로가기 지원</strong>
            <p>브라우저 뒤로가기를 눌러도 앱이 바로 종료되지 않도록 상태 전환을 유지합니다.</p>
          </article>
        </section>

        {screen === 'home' && (
          <>
            <section className="hero card">
              <span className="eyebrow">창업톡</span>
              <h1>
                내가 원하는 지역에서
                <br />
                장사를 시작하려면 얼마가 필요할까?
              </h1>
              <p>지역, 창업 형태, 업종, 면적, 보유자금, 운영 인원과 실제 견적을 넣으면 총 창업비와 상권 적합도를 함께 분석합니다.</p>
              <div className="hero-actions">
                <button className="primary-button" type="button" onClick={onAnalyze}>
                  내 창업비용 분석하기
                </button>
                <button className="secondary-button" type="button" onClick={onSearch}>
                  내 돈으로 가능한 창업 찾기
                </button>
              </div>
            </section>
            <section className="card">
              <span className="eyebrow">제휴 고지</span>
              <p>운영 배너와 제휴 고지는 실제 운영에서 필요한 전환용 문구입니다. 광고 ID가 없으면 미등록 상태로 유지하고 임의 생성하지 않습니다.</p>
            </section>
            {getRemainingAnalyses(usage) <= 0 && renderEntitlementCard()}
          </>
        )}

        {screen === 'analysis' && (
          <>
            {renderAnalysisHeader()}
            {renderWizardStep()}
            {getRemainingAnalyses(usage) <= 0 && renderEntitlementCard()}
          </>
        )}

        {screen === 'search' && renderSearch()}
        {screen === 'compare' && renderCompare()}
        {screen === 'brand' && renderBrand()}
      </main>
    </AppErrorBoundary>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default App;
