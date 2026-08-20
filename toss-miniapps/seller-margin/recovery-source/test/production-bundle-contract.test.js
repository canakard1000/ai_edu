import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const bundlePath = new URL('../public/assets/index-W9YHdgne.js', import.meta.url);
const canonicalPath = new URL('../../current-source/sources/assets/index-W9YHdgne.js', import.meta.url);
const bundle = await readFile(bundlePath, 'utf8');
const canonical = await readFile(canonicalPath);
const bundleHash = createHash('sha256').update(await readFile(bundlePath)).digest('hex');
const canonicalHash = createHash('sha256').update(canonical).digest('hex');

test('recovery keeps the canonical calculator bundle byte-for-byte intact', () => {
  assert.equal(bundleHash, canonicalHash);
});

const featureContracts = [
  ['supply cost input', '상품 공급가'],
  ['supplier shipping input', '공급사 배송비'],
  ['sales fee input', '판매 수수료'],
  ['target margin input', '목표 순마진율'],
  ['packaging cost input', '포장비'],
  ['advertising cost input', '광고비'],
  ['refund reserve input', '예상 반품비'],
  ['tax and other cost input', '세금·기타 비용'],
  ['recommended price action', '권장 판매가 계산하기'],
  ['expected net profit result', '예상 순이익'],
  ['actual margin result', '실제 순마진율'],
  ['roi result', '투자수익률 ROI'],
  ['market fee comparison', '판매처별 마진 비교'],
  ['naver marketplace fee', '네이버'],
  ['coupang marketplace fee', '쿠팡'],
  ['smartstore marketplace fee', '토스쇼핑'],
  ['saved calculation action', '이 계산 저장하기'],
  ['saved calculation list', '저장한 계산 보기'],
  ['pro benefits entry point', 'PRO 혜택·이용권 보기'],
  ['monthly subscription option', 'PRO 월간'],
  ['annual subscription option', 'PRO 연간'],
  ['subscription restore option', '이전 구독 복원'],
  ['csv feature copy', '계산 기록·CSV'],
  ['affiliate disclosure', '제휴 링크가 포함되어'],
  ['share recommendation entry point', '오늘의 쇼핑 혜택 보기'],
  ['banner advertising mount point', 'toss-banner-ad'],
];

for (const [name, contract] of featureContracts) {
  test(`canonical bundle retains ${name}`, () => {
    assert.ok(bundle.includes(contract));
  });
}
