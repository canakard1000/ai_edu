import './style.css'

const won = value => `${Math.round(value).toLocaleString('ko-KR')}원`
const number = id => Number(document.querySelector(`#${id}`).value.replace(/[^0-9.]/g, '')) || 0

document.querySelector('#app').innerHTML = `
  <main>
    <header><div class="mark">₩</div><div><h1>셀러마진</h1><p>판매 전, 내 순이익을 확인하세요</p></div></header>
    <section class="card"><h2>비용과 목표 입력</h2><div class="grid">
      <label>상품 공급가<input id="cost" inputmode="numeric" value="10000"></label>
      <label>공급사 배송비<input id="shipping" inputmode="numeric" value="3000"></label>
      <label>판매 수수료 (%)<input id="fee" inputmode="decimal" value="6"></label>
      <label>목표 순마진율 (%)<input id="marginTarget" inputmode="decimal" value="30"></label>
      <label>포장·기타 비용<input id="extra" inputmode="numeric" value="0"></label>
      <label>구매자 배송비<input id="customerShipping" inputmode="numeric" value="0"></label>
    </div><button id="calculate">권장 판매가 계산하기</button></section>
    <section class="result"><span>목표 순마진을 위한 권장 판매가</span><strong id="price">20,220원</strong><div class="metrics"><p>총 원가 <b id="total">13,000원</b></p><p>예상 판매 수수료 <b id="feeValue">1,213원</b></p><p>예상 순이익 <b id="profit">6,007원</b></p><p>실제 순마진율 <b id="margin">30.0%</b></p></div></section>
    <section class="recommend"><span>오늘의 추천 상품</span><h2>에어르 베놈 차량용 청소기</h2><p>팬텀블랙 · 1개</p><a href="https://toss.im/_m/zJaSRnlw" target="_blank" rel="noopener">토스쇼핑에서 상품 보기</a><small>이 링크를 통한 구매 시 일정액의 수수료를 받을 수 있습니다.</small></section>
    <p class="note">계산 결과는 예상치입니다. 광고비·반품비·부가세 등 실제 운영 비용을 함께 확인하세요.</p>
  </main>`

function calculate() {
  const base = number('cost') + number('shipping') + number('extra')
  const target = number('marginTarget') / 100
  const fee = number('fee') / 100
  const customerShipping = number('customerShipping')
  const denominator = 1 - target - fee
  if (denominator <= 0) return
  const price = Math.ceil(((base - customerShipping) / denominator) / 10) * 10
  const revenue = price + customerShipping
  const feeValue = revenue * fee
  const profit = revenue - feeValue - base
  document.querySelector('#price').textContent = won(price)
  document.querySelector('#total').textContent = won(base)
  document.querySelector('#feeValue').textContent = won(feeValue)
  document.querySelector('#profit').textContent = won(profit)
  document.querySelector('#margin').textContent = `${(profit / revenue * 100).toFixed(1)}%`
}
document.querySelector('#calculate').addEventListener('click', calculate)
document.querySelectorAll('input').forEach(input => input.addEventListener('input', calculate))
calculate()
