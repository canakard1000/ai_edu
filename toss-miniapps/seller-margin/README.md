# 셀러마진

## Toss 식별정보

- 앱명: 셀러마진
- 실제 appName: `seller-margin`
- 현재 출시본: `20260816-22` (SDK `3.0.3`, 2026-08-19 출시)
- 최신 출시 준비본: `20260819-28` (SDK `3.0.3`, 검토 필요)

## 복구 상태

이 폴더의 루트 풀 소스는 로컬 보관 ZIP에서 복구한 **legacy source**입니다. 해당 원본의 config appName은 `toss-seller-margin`으로 실제 콘솔 식별자와 다르므로, 현재 출시본이나 최신 준비본과 동일하다고 간주하지 않습니다.

- legacy source archive: `seller-margin-appintoss-project.zip` (2026-08-05 보관본)
- 최신 로컬 번들 archive: `archives/seller-margin-20260814.ait`
- 최신 로컬 번들 SHA-256: `5E3308EE2ED92D89C7C3971F1F98B436CDBF66904D6FC200054E004914877248`

`archives/seller-margin-20260814.ait`에는 실제 appName `seller-margin`을 사용하는 canonical 웹 번들이 포함되어 있습니다. 해당 번들에서 추출한 읽기 전용 자산은 `current-source/`에 보관합니다.

`recovery-source/`는 canonical 번들을 그대로 사용하는 별도 출시 후보입니다. 이 프로젝트는 공식 `graniteEvent`의 `backEvent` 처리와 browser fallback만 추가하며, 계산·PRO·CSV·광고·공유 로직은 원본 번들을 변경하지 않습니다.

## 운영 원칙

- 현재 출시본 `20260816-22`은 실기 검증 전까지 수정하지 않습니다.
- 최신 준비본 `20260819-28`은 현재 출시본 및 소스 차이 확인 전까지 등록하지 않습니다.
- 실제 `seller-margin` 소스가 확보되거나 실기에서 문제가 확인된 경우에만 별도 복구·업그레이드를 진행합니다.
- Secret, 광고 ID, 결제 상품 ID, 제휴 URL은 저장소에 보관하지 않습니다.
