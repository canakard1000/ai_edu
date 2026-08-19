import React, { useEffect, useRef, useState } from 'react';
import { INDUSTRY_GROUPS, INDUSTRY_PROFILES, getAllIndustryOptions, getIndustriesByGroup } from './data/industries';
import { REGION_PROVINCES, getRegionHints } from './data/regions';
import { calculateStartupAnalysis } from './calculation';
import type {
  AnalysisResult,
  ComparisonResult,
  ReverseCandidate,
  StartupInputs
} from './types/startup';
import { formatCompactWon, formatDelta, formatMonths, formatPercent, formatScore, formatWon } from './utils/currency';
import './styles.css';

const STEP_TITLES = ['지역', '창업형태', '업종', '면적', '보유자금', '운영조건', '분석'];
const APP_NAME = import.meta.env.VITE_APP_NAME ?? '창업톡';
const AD_GROUP_ID = import.meta.env.VITE_TOSS_AD_GROUP_ID ?? 'TODO_REPLACE_WITH_OPERATIONAL_ID';
const BASE_URL = import.meta.env.VITE_APP_BASE_URL ?? window.location.origin;

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
  comparisonArea: '불당동 중심상권'
};

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

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5 | 6;

function App() {
  const [mode, setMode] = useState<'home' | 'analysis' | 'search' | 'compare'>('home');
  const [step, setStep] = useState<WizardStep>(0);
  const [inputs, setInputs] = useState<StartupInputs>(DEFAULT_INPUTS);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [searchResults, setSearchResults] = useState<ReverseCandidate[]>([]);
  const [comparison, setComparison] = useState<ComparisonResult | null>(null);
  const [notice, setNotice] = useState('모바일 우선 레이아웃으로 준비되었습니다.');
  const latestInputsRef = useRef(inputs);

  const selectedProfile = INDUSTRY_PROFILES.find((profile) => profile.id === inputs.industryId) ?? INDUSTRY_PROFILES[0];
  const visibleProfiles = getIndustriesByGroup(inputs.mode);

  useEffect(() => {
    latestInputsRef.current = inputs;
  }, [inputs]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const nextState = event.state as typeof window.history.state | undefined;
      if (nextState?.mode) {
        setMode(nextState.mode);
        setStep((nextState.step ?? 0) as WizardStep);
        if (nextState.inputs) {
          setInputs(nextState.inputs);
        }
        return;
      }

      setMode('home');
      setStep(0);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    window.history.pushState({ mode, step, inputs: latestInputsRef.current }, '', window.location.pathname + window.location.search);
  }, [mode, step]);

  useEffect(() => {
    window.history.replaceState({ mode, step, inputs }, '', window.location.pathname + window.location.search);
  }, [inputs, mode, step]);

  useEffect(() => {
    if (mode !== 'analysis') {
      return;
    }

    setStatus('loading');
    setErrorMessage('');
    const timer = window.setTimeout(() => {
      try {
        const nextAnalysis = calculateStartupAnalysis(inputs, selectedProfile);
        setAnalysis(nextAnalysis);
        setStatus('ready');
      } catch (error) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.');
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [mode, inputs, selectedProfile]);

  useEffect(() => {
    if (mode !== 'search') {
      return;
    }

    const timer = window.setTimeout(() => {
      const candidates = getAllIndustryOptions()
        .filter((profile) => profile.minCapital <= inputs.availableCapital * 1.35)
        .map((profile) => {
          const nextInputs = { ...inputs, industryId: profile.id };
          const analysisResult = calculateStartupAnalysis(nextInputs, profile);
          const affordabilityScore = Math.max(0, 100 - Math.abs(analysisResult.capitalGap) / 4000000);
          const operatingDifficulty = profile.operationalComplexity + (analysisResult.breakdown.monthlyFixedCost > inputs.availableCapital * 0.1 ? 8 : 0);

          return {
            profile,
            analysis: analysisResult,
            affordabilityScore: Number(affordabilityScore.toFixed(1)),
            operatingDifficulty,
            suitabilityNote:
              analysisResult.capitalGap >= 0
                ? '보유자금 안에서 시작 가능성이 있는 후보입니다.'
                : '추가 자금 또는 비용 절감이 필요합니다.'
          } satisfies ReverseCandidate;
        })
        .sort((left, right) => {
          const leftScore =
            left.affordabilityScore + left.analysis.scoring.score - left.operatingDifficulty + (left.analysis.capitalGap >= 0 ? 12 : 0);
          const rightScore =
            right.affordabilityScore + right.analysis.scoring.score - right.operatingDifficulty + (right.analysis.capitalGap >= 0 ? 12 : 0);
          return rightScore - leftScore;
        })
        .slice(0, 5);

      setSearchResults(candidates);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [inputs, mode]);

  useEffect(() => {
    if (mode !== 'compare') {
      return;
    }

    const compareInputs = {
      ...inputs,
      district: inputs.district,
      neighborhood: inputs.neighborhood,
      commercialArea: inputs.comparisonArea
    };
    const leftAnalysis = calculateStartupAnalysis(compareInputs, selectedProfile);
    const rightInputs = {
      ...compareInputs,
      district: inputs.secondaryDistrict,
      neighborhood: inputs.secondaryDistrict,
      commercialArea: `${inputs.secondaryDistrict} 상권`
    };
    const rightAnalysis = calculateStartupAnalysis(rightInputs, selectedProfile);

    setComparison({
      left: leftAnalysis,
      right: rightAnalysis,
      deltas: {
        deposit: rightAnalysis.breakdown.deposit - leftAnalysis.breakdown.deposit,
        monthlyRent: rightAnalysis.breakdown.monthlyRent - leftAnalysis.breakdown.monthlyRent,
        totalInvestment: rightAnalysis.breakdown.totalInvestment - leftAnalysis.breakdown.totalInvestment,
        competitorCount:
          rightAnalysis.context.competitorExamples.length - leftAnalysis.context.competitorExamples.length,
        expectedSales: rightAnalysis.breakdown.expectedSales - leftAnalysis.breakdown.expectedSales,
        breakEvenSales: rightAnalysis.breakdown.breakEvenSales - leftAnalysis.breakdown.breakEvenSales,
        operatingProfit: rightAnalysis.breakdown.operatingProfit - leftAnalysis.breakdown.operatingProfit,
        paybackMonths:
          (rightAnalysis.breakdown.paybackMonths ?? 0) - (leftAnalysis.breakdown.paybackMonths ?? 0),
        scoring: rightAnalysis.scoring.score - leftAnalysis.scoring.score
      }
    });
  }, [inputs, mode, selectedProfile]);

  function setHistoryMode(nextMode: typeof mode, nextStep: WizardStep = 0) {
    setMode(nextMode);
    setStep(nextStep);
    setNotice(nextMode === 'home' ? '홈으로 돌아왔습니다.' : '선택한 흐름으로 이동했습니다.');
  }

  function updateInput<K extends keyof StartupInputs>(key: K, value: StartupInputs[K]) {
    setInputs((current) => ({ ...current, [key]: value }));
  }

  function goHome() {
    setHistoryMode('home', 0);
  }

  function openAnalysis() {
    setHistoryMode('analysis', 0);
  }

  function openSearch() {
    setHistoryMode('search', 0);
  }

  function openCompare() {
    setHistoryMode('compare', 0);
  }

  function prevStep() {
    if (step === 0) {
      goHome();
      return;
    }

    setStep((current) => Math.max(0, (current - 1) as WizardStep) as WizardStep);
  }

  async function shareCurrentView() {
    const shareText = analysis
      ? `${APP_NAME} 분석 결과: ${analysis.profile.name}, ${formatCompactWon(analysis.breakdown.totalInvestment)} 필요`
      : `${APP_NAME} - ${inputs.province} ${inputs.district}`;

    const payload = {
      title: APP_NAME,
      text: shareText,
      url: BASE_URL
    };

    try {
      if (navigator.share) {
        await navigator.share(payload);
        setNotice('공유를 열었습니다.');
        return;
      }

      await navigator.clipboard.writeText(`${payload.title}\n${payload.text}\n${payload.url}`);
      setNotice('공유 링크를 클립보드에 복사했습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '공유에 실패했습니다.');
    }
  }

  function refreshAnalysis() {
    if (mode === 'analysis') {
      setStatus('loading');
    }
    setNotice('분석을 다시 계산했습니다.');
    setInputs((current) => ({ ...current }));
  }

  function choosePresetArea(area: number) {
    setInputs((current) => ({
      ...current,
      areaPyeong: area,
      useCustomArea: false,
      customAreaPyeong: area
    }));
  }

  function renderStep() {
    if (step === 0) {
      const hints = getRegionHints(inputs.province);
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
              <input
                list="district-hints"
                value={inputs.district}
                onChange={(event) => updateInput('district', event.target.value)}
                placeholder="예: 천안시"
              />
              <datalist id="district-hints">
                {hints.map((hint) => (
                  <option key={hint} value={hint} />
                ))}
              </datalist>
            </label>
            <label>
              읍/면/동 또는 상권
              <input
                value={inputs.neighborhood}
                onChange={(event) => updateInput('neighborhood', event.target.value)}
                placeholder="예: 불당동"
              />
            </label>
            <label>
              상권 이름
              <input
                value={inputs.commercialArea}
                onChange={(event) => updateInput('commercialArea', event.target.value)}
                placeholder="예: 불당 상권"
              />
            </label>
          </div>
          <div className="hint-box">
            전국 확장을 위해 상위 지역은 선택형, 세부 상권은 자유 입력으로 설계했습니다.
          </div>
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
          <div className="hint-box">
            업종은 데이터 객체에서 분리되어 있어 향후 새 항목을 쉽게 추가할 수 있습니다.
          </div>
        </section>
      );
    }

    if (step === 3) {
      return (
        <section className="card">
          <h2>STEP 4 면적</h2>
          <div className="area-grid">
            {[5, 10, 15, 20, 30].map((area) => (
              <button
                type="button"
                key={area}
                className={`area-pill ${(inputs.useCustomArea ? inputs.customAreaPyeong : inputs.areaPyeong) === area && !inputs.useCustomArea ? 'active' : ''}`}
                onClick={() => choosePresetArea(area)}
              >
                {area}평
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
            {selectedProfile.recommendedAreas.includes(inputs.useCustomArea ? inputs.customAreaPyeong : inputs.areaPyeong)
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
            동반 운영 인원
            <select value={inputs.operatingStaff} onChange={(event) => updateInput('operatingStaff', Number(event.target.value))}>
              <option value={0}>0명</option>
              <option value={1}>1명</option>
              <option value={2}>2명</option>
              <option value={3}>3명</option>
              <option value={4}>4명 이상</option>
            </select>
          </label>
          <div className="hint-box">
            현재 선택값 기준으로 총 투자비와 자금 차이를 바로 계산합니다.
          </div>
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
            <label>
              비교 지역 1
              <input
                value={inputs.secondaryDistrict}
                onChange={(event) => updateInput('secondaryDistrict', event.target.value)}
                placeholder="예: 천안시 두정동"
              />
            </label>
            <label>
              비교 지역 2
              <input
                value={inputs.comparisonArea}
                onChange={(event) => updateInput('comparisonArea', event.target.value)}
                placeholder="예: 불당동 중심상권"
              />
            </label>
          </div>
          <div className="hint-box">
            운영조건은 배달 비중과 인력 배치에 따라 월 고정비와 손익분기점이 달라집니다.
          </div>
        </section>
      );
    }

    return (
      <section className="card">
        <h2>STEP 7 분석</h2>
        {status === 'loading' && <p className="status-text">분석 값을 계산하는 중입니다...</p>}
        {status === 'error' && <p className="status-text error">{errorMessage}</p>}
        {analysis && status === 'ready' && (
          <>
            <div className="summary-hero">
              <div>
                <span className="eyebrow">총 예상 창업비</span>
                <strong>{formatWon(analysis.breakdown.totalInvestment)}</strong>
                <p>{formatCompactWon(analysis.breakdown.totalInvestment)} 규모로 계산되었습니다.</p>
              </div>
              <div>
                <span className="eyebrow">자금 차이</span>
                <strong className={analysis.capitalGap >= 0 ? 'positive' : 'negative'}>{formatDelta(analysis.capitalGap)}</strong>
                <p>{analysis.capitalGap >= 0 ? '보유자금이 충분합니다.' : '보유자금이 부족합니다.'}</p>
              </div>
            </div>
            <div className="metric-grid">
              <Metric label="예상 보증금" value={formatWon(analysis.breakdown.deposit)} />
              <Metric label="예상 월세" value={formatWon(analysis.breakdown.monthlyRent)} />
              <Metric label="권리금" value={analysis.breakdown.premium > 0 ? formatWon(analysis.breakdown.premium) : '데이터 없음'} />
              <Metric label="상권 적합도" value={`${analysis.scoring.grade} · ${formatScore(analysis.scoring.score)}`} />
              <Metric label="예상 월매출" value={formatWon(analysis.breakdown.expectedSales)} />
              <Metric label="손익분기 매출" value={formatWon(analysis.breakdown.breakEvenSales)} />
              <Metric label="예상 월 영업이익" value={formatWon(analysis.breakdown.operatingProfit)} />
              <Metric label="투자금 회수기간" value={formatMonths(analysis.breakdown.paybackMonths)} />
            </div>
          </>
        )}
        {analysis && status === 'ready' && (
          <>
            <section className="subsection">
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
            </section>
            <section className="subsection">
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
                  </article>
                ))}
              </div>
            </section>
            <section className="subsection">
              <h3>주변 경쟁업체</h3>
              <ul className="list compact">
                {analysis.context.competitorExamples.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mock-label">{analysis.context.notes}</p>
            </section>
            <section className="subsection">
              <h3>주요 위험요인</h3>
              <ul className="list compact">
                {analysis.risks.map((risk) => (
                  <li key={risk}>{risk}</li>
                ))}
              </ul>
            </section>
            <section className="subsection">
              <h3>개선 제안</h3>
              <ul className="list compact">
                {analysis.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </section>
            <section className="subsection">
              <h3>법적/서비스 고지</h3>
              <p className="disclaimer">
                본 분석은 공개 데이터와 입력 조건을 기반으로 한 예상치이며 실제 임대료, 매출, 공사비 및 사업 성과와 차이가 발생할 수 있습니다.
              </p>
              <p className="mock-label">{analysis.affiliateNotice}</p>
            </section>
          </>
        )}
        {!analysis && status !== 'loading' && <p className="status-text">분석을 실행하면 결과가 표시됩니다.</p>}
      </section>
    );
  }

  function renderCurrentView() {
    if (mode === 'home') {
      return (
        <>
          <section className="hero card">
            <span className="eyebrow">창업톡</span>
            <h1>
              내가 원하는 지역에서
              <br />
              장사를 시작하려면 얼마가 필요할까?
            </h1>
            <p>
              지역, 창업 형태, 업종, 면적, 보유자금, 운영 인원을 입력하면 총 창업비와 상권 적합도를 함께 분석합니다.
            </p>
            <div className="hero-actions">
              <button className="primary-button" type="button" onClick={openAnalysis}>
                내 창업비용 분석하기
              </button>
              <button className="secondary-button" type="button" onClick={openSearch}>
                내 돈으로 가능한 창업 찾기
              </button>
            </div>
          </section>
          <section className="card banner-card">
            <span className="eyebrow">운영용 배너광고</span>
            <strong>{AD_GROUP_ID}</strong>
            <p>
              운영용 광고 그룹 ID를 아직 넣지 않았다면 `.env`에서 교체하세요. 테스트용 광고 ID는 운영 빌드에 넣지 않습니다.
            </p>
          </section>
          <section className="card">
            <span className="eyebrow">제휴 고지</span>
            <p>일부 기능은 제휴 및 광고 영역과 함께 배치될 수 있습니다. 실제 운영 연결은 환경변수 기반으로 분리해야 합니다.</p>
          </section>
        </>
      );
    }

    if (mode === 'search') {
      return (
        <section className="card">
          <h2>내 돈으로 가능한 창업 찾기</h2>
          <p>보유자금과 지역을 기준으로 시작 가능성이 높은 업종 후보를 정렬했습니다.</p>
          <div className="metric-grid compact">
            <Metric label="보유자금" value={formatWon(inputs.availableCapital)} />
            <Metric label="지역" value={`${inputs.province} ${inputs.district}`} />
            <Metric label="운영 인원" value={`${inputs.operatingStaff}명`} />
            <Metric label="모드" value={inputs.mode} />
          </div>
          <div className="candidate-list">
            {searchResults.map((candidate) => (
              <article key={candidate.profile.id} className="candidate-card">
                <div>
                  <strong>{candidate.profile.name}</strong>
                  <p>{candidate.profile.summary}</p>
                </div>
                <div className="candidate-metrics">
                  <span>필요자금 {formatWon(candidate.analysis.breakdown.totalInvestment)}</span>
                  <span>예상 고정비 {formatWon(candidate.analysis.breakdown.monthlyFixedCost)}</span>
                  <span>운영난이도 {candidate.operatingDifficulty.toFixed(0)}/100</span>
                  <span>상권 적합도 {candidate.analysis.scoring.grade}</span>
                  <span>BEP {formatWon(candidate.analysis.breakdown.breakEvenSales)}</span>
                </div>
                <p className="candidate-note">{candidate.suitabilityNote}</p>
              </article>
            ))}
          </div>
        </section>
      );
    }

    if (mode === 'compare') {
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
          {comparison && (
            <div className="comparison-grid">
              <article className="comparison-card">
                <strong>{comparison.left.context.district}</strong>
                <p>보증금 {formatWon(comparison.left.breakdown.deposit)}</p>
                <p>월세 {formatWon(comparison.left.breakdown.monthlyRent)}</p>
                <p>총 투자비 {formatWon(comparison.left.breakdown.totalInvestment)}</p>
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
                <p>총 투자비 {formatWon(comparison.right.breakdown.totalInvestment)}</p>
                <p>경쟁점포 {comparison.right.context.competitorExamples.length}곳</p>
                <p>예상매출 {formatWon(comparison.right.breakdown.expectedSales)}</p>
                <p>BEP {formatWon(comparison.right.breakdown.breakEvenSales)}</p>
                <p>예상 영업이익 {formatWon(comparison.right.breakdown.operatingProfit)}</p>
                <p>투자금 회수기간 {formatMonths(comparison.right.breakdown.paybackMonths)}</p>
                <p>상권 적합도 {comparison.right.scoring.grade}</p>
              </article>
            </div>
          )}
          {comparison && (
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
          )}
        </section>
      );
    }

    return (
      <>
        <section className="card summary-header">
          <div>
            <span className="eyebrow">현재 선택</span>
            <h2>
              {inputs.province} {inputs.district} · {selectedProfile.name}
            </h2>
            <p>{selectedProfile.summary}</p>
          </div>
          <div className="summary-actions">
            <button className="secondary-button" type="button" onClick={shareCurrentView}>
              공유
            </button>
            <button className="secondary-button" type="button" onClick={refreshAnalysis}>
              다시 계산
            </button>
          </div>
        </section>
        {renderStep()}
      </>
    );
  }

  return (
    <AppErrorBoundary>
      <main className="shell">
        <header className="topbar">
          <button type="button" className="ghost-button" onClick={goHome}>
            홈
          </button>
          <div className="topbar-title">
            <strong>{APP_NAME}</strong>
            <span>{notice}</span>
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
              className={`step-chip ${mode === 'analysis' && step === index ? 'active' : ''}`}
              onClick={() => setHistoryMode('analysis', index as WizardStep)}
            >
              {index + 1}. {title}
            </button>
          ))}
        </nav>
        <section className="quick-actions">
          <button type="button" className="quick-button" onClick={openAnalysis}>
            내 창업비용 분석하기
          </button>
          <button type="button" className="quick-button" onClick={openSearch}>
            내 돈으로 가능한 창업 찾기
          </button>
          <button type="button" className="quick-button" onClick={openCompare}>
            지역 비교
          </button>
        </section>
        <section className="banner-row">
          <article className="mini-banner">
            <span className="eyebrow">운영 배너</span>
            <strong>{AD_GROUP_ID}</strong>
            <p>실제 운영 전환 시에는 환경변수로만 주입하고, 테스트 광고 ID는 넣지 마세요.</p>
          </article>
          <article className="mini-banner">
            <span className="eyebrow">홈 복귀</span>
            <strong>모바일 뒤로가기 지원</strong>
            <p>버튼과 브라우저 뒤로가기를 모두 같은 상태 전환으로 묶었습니다.</p>
          </article>
        </section>
        {renderCurrentView()}
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
