# 창업톡 (Changup Talk)

대한민국 예비창업자를 위한 토스 미니앱형 분석 도구입니다.

## 실행

```bash
npm install
npm run dev
```

## 스크립트

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run build`

## 주의

- 외부 공공데이터 연동은 mock 어댑터로 분리되어 있습니다.
- 운영용 광고 그룹 ID는 `.env`에서 주입하세요.
- 실제 서비스 전환 시에는 mock 표시를 제거하고 실데이터 어댑터를 연결해야 합니다.
