import { useState } from 'react';
import { Device, OpenCameraPermissionError } from '@apps-in-toss/web-framework';
import './guide.css';

type Result = { hydration: number; oil: number; redness: number; texture: number };
type Step = 'home' | 'guide' | 'preview' | 'result';
const routine = [['01', '순한 세안', '미지근한 물로 30초 이내'], ['02', '수분 진정', '토너·세럼을 얇게 1~2회'], ['03', '자외선 차단', '외출 전 충분히 도포']];

export default function App() {
  const [step, setStep] = useState<Step>('home');
  const [result, setResult] = useState<Result | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [notice, setNotice] = useState('촬영 이미지는 분석 후 저장하지 않아요.');
  const openCamera = async () => {
    try {
      setNotice('카메라를 여는 중이에요. 촬영 버튼을 한 번 누르면 다음 화면으로 이동해요.');
      const image = await Device.openCamera({ base64: true, maxWidth: 768 });
      setPhoto(image.dataUri); setResult(await inspectImageTone(image.dataUri)); setStep('preview');
    } catch (error) {
      setNotice(error instanceof OpenCameraPermissionError ? '카메라 권한이 필요해요. 토스 앱 설정에서 카메라를 허용한 뒤 다시 시도해 주세요.' : '촬영이 취소됐어요. 원할 때 다시 시작할 수 있어요.');
    }
  };
  const reset = () => { setStep('home'); setResult(null); setPhoto(null); };
  return <main className="app">
    <header><span className="brand">피부루틴</span><span className="date">오늘의 피부 컨디션</span></header>
    {step === 'home' && <section className="hero"><div className="face">✦</div><p className="eyebrow">내 피부를 위한 1분</p><h1>오늘의 피부 컨디션을<br/>가볍게 확인해요</h1><p className="sub">의료 진단이 아닌, 일상 피부 관리 참고용 분석입니다.</p><button onClick={() => setStep('guide')}>컨디션 확인 시작</button><p className="privacy">🔒 {notice}</p></section>}
    {step === 'guide' && <section className="guide"><p className="eyebrow">촬영 전 확인 · 약 10초</p><h1>얼굴을 이 선에 맞춰주세요</h1><div className="camera-guide"><span className="arrow top">↓</span><span className="oval">🙂</span><span className="arrow bottom">↑</span></div><ol><li><b>정면을 바라봐요</b><span>얼굴 전체가 타원 안에 들어오게 해요.</span></li><li><b>휴대폰을 팔 한 뼘 거리로</b><span>너무 가깝거나 멀지 않게 맞춰요.</span></li><li><b>밝은 곳에서 촬영해요</b><span>그림자와 강한 필터는 피해주세요.</span></li></ol><p className="tip">카메라가 열리면 정면을 보고, 화면의 촬영 버튼을 한 번 눌러주세요.</p><button onClick={openCamera}>카메라 열기</button><button className="text-button" onClick={() => setStep('home')}>돌아가기</button></section>}
    {step === 'preview' && photo && <section className="preview"><p className="eyebrow">촬영 완료</p><h1>사진이 잘 찍혔나요?</h1><img className="preview-image" src={photo} alt="방금 촬영한 참고 이미지"/><p className="sub">얼굴이 흐리거나 어두우면 다시 촬영해 주세요.</p><button onClick={() => setStep('result')}>분석 결과 보기</button><button className="outline" onClick={openCamera}>다시 촬영하기</button></section>}
    {step === 'result' && result && <><section className="summary">{photo && <img className="capture" src={photo} alt="방금 촬영한 참고 이미지"/>}<p>오늘은</p><h1>수분을 조금 더 채워주세요</h1><span>촬영 이미지의 밝기·색감 기반 참고 결과 · 의료 진단이 아닙니다</span></section><section className="scores"><Score label="수분" value={result.hydration} tone="blue"/><Score label="유분 균형" value={result.oil} tone="green"/><Score label="붉은기" value={result.redness} tone="peach"/><Score label="피부결" value={result.texture} tone="purple"/></section><section className="routine"><h2>오늘의 3단계 루틴</h2>{routine.map(([n, title, detail]) => <article key={n}><b>{n}</b><div><strong>{title}</strong><p>{detail}</p></div></article>)}</section><button className="outline" onClick={reset}>처음으로 돌아가기</button></>}
  </main>;
}
function Score({ label, value, tone }: { label: string; value: number; tone: string }) { return <article className={`score ${tone}`}><span>{label}</span><strong>{value}</strong><div><i style={{ width: `${value}%` }}/></div></article>; }
async function inspectImageTone(dataUri: string): Promise<Result> { const image = new Image(); image.src = dataUri; await image.decode(); const canvas = document.createElement('canvas'); const width = Math.min(image.width, 160); const height = Math.max(1, Math.round(image.height * (width / image.width))); canvas.width = width; canvas.height = height; const context = canvas.getContext('2d', { willReadFrequently: true })!; context.drawImage(image, 0, 0, width, height); const pixels = context.getImageData(0, 0, width, height).data; let red = 0, green = 0, blue = 0; for (let i = 0; i < pixels.length; i += 4) { red += pixels[i]; green += pixels[i + 1]; blue += pixels[i + 2]; } const count = pixels.length / 4; const brightness = (red + green + blue) / (count * 3); const warm = Math.max(0, red / count - (green + blue) / (count * 2)); return { hydration: clamp(Math.round(42 + brightness / 5)), oil: clamp(Math.round(70 - brightness / 7)), redness: clamp(Math.round(18 + warm / 2)), texture: clamp(Math.round(45 + brightness / 6)) }; }
function clamp(value: number) { return Math.max(0, Math.min(100, value)); }
