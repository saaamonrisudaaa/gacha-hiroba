/* ガチャ予算プランナー。
   入力値はブラウザ内で計算するだけで、保存・送信・計測しない。 */
(function () {
  'use strict';

  var form = document.getElementById('budgetPlanner');
  var result = document.getElementById('budgetResult');
  if (!form || !result) return;

  function numberOf(id, fallback) {
    var field = document.getElementById(id);
    var value = field ? Number(field.value) : fallback;
    return Number.isFinite(value) ? value : fallback;
  }

  function yen(value) {
    return Math.max(0, Math.floor(value)).toLocaleString('ja-JP') + '円';
  }

  function render(event) {
    if (event) event.preventDefault();
    if (!form.reportValidity()) return;

    var total = Math.max(0, Math.floor(numberOf('budgetTotal', 0)));
    var reserve = Math.max(0, Math.floor(numberOf('budgetReserve', 0)));
    var price = Math.max(1, Math.floor(numberOf('budgetPrice', 1)));
    var kinds = Math.max(0, Math.floor(numberOf('budgetKinds', 0)));
    var stores = Math.max(1, Math.floor(numberOf('budgetStores', 1)));
    var available = Math.max(0, total - reserve);
    var runs = Math.floor(available / price);
    var spend = runs * price;
    var remainder = available - spend;
    var cashRemaining = total - spend;
    var perStoreBudget = Math.floor(available / stores);
    var perStoreRuns = Math.floor(perStoreBudget / price);
    var minimum = kinds ? kinds * price : 0;
    var hundredCoins = Number.isInteger(price / 100) ? runs * (price / 100) : null;

    var rows = [
      ['ガチャに使える上限', yen(available)],
      ['最大で回せる回数', runs.toLocaleString('ja-JP') + '回'],
      ['その回数で使う金額', yen(spend)],
      ['ガチャ枠の余り', yen(remainder)],
      ['持参金の残り（確保分を含む）', yen(cashRemaining)],
      ['1店舗あたりの目安', yen(perStoreBudget) + '・最大' + perStoreRuns.toLocaleString('ja-JP') + '回']
    ];
    if (kinds) rows.push(['重複なしの場合の理論上の最低額', yen(minimum)]);
    if (hundredCoins != null) rows.push(['すべて100円硬貨で払う場合', hundredCoins.toLocaleString('ja-JP') + '枚']);

    result.innerHTML =
      '<h3>計算結果</h3><dl>' + rows.map(function (row) {
        return '<div><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>';
      }).join('') + '</dl>' +
      (reserve > total
        ? '<p class="gh-tool__warning">残しておく金額が持参予算以上のため、ガチャに使える上限は0円です。</p>'
        : '') +
      (kinds
        ? '<p class="gh-tool__warning">最低額は重複が一度もない場合の理論値で、全種類そろうことを保証しません。</p>'
        : '');
  }

  form.addEventListener('submit', render);
  ['budgetTotal', 'budgetReserve', 'budgetPrice', 'budgetKinds', 'budgetStores'].forEach(function (id) {
    var field = document.getElementById(id);
    if (field) field.addEventListener('change', render);
  });
  render();
})();
