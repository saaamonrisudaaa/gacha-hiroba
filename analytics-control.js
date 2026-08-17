'use strict';

/* 検索非掲載の運営者用ページから、このブラウザだけGA4計測を除外・解除する。 */
(function () {
  var control = window.GHAnalyticsControl;
  var status = document.querySelector('[data-gh-owner-status]');
  var date = document.querySelector('[data-gh-owner-date]');
  var message = document.querySelector('[data-gh-owner-message]');
  var enablePanel = document.querySelector('[data-gh-owner-enable-panel]');
  var disablePanel = document.querySelector('[data-gh-owner-disable-panel]');
  var enableButton = document.querySelector('[data-gh-owner-enable]');
  var disableButton = document.querySelector('[data-gh-owner-disable]');

  if (!control || !status || !enableButton || !disableButton) return;

  function formatDate(value) {
    if (!value) return '';
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(parsed);
  }

  function render(nextMessage, isError) {
    var record = control.getOwnerExclusion();
    var excluded = Boolean(record);
    status.textContent = excluded ? '除外中（GA4へ送信しません）' : '未設定（通常の同意設定に従います）';
    status.className = excluded ? 'is-excluded' : 'is-not-excluded';
    date.textContent = excluded && record.setAt ? '設定日時：' + formatDate(record.setAt) : '';
    enablePanel.hidden = excluded;
    disablePanel.hidden = !excluded;
    enableButton.disabled = excluded;
    disableButton.disabled = !excluded;
    message.textContent = nextMessage || '';
    message.classList.toggle('gh-owner-control__error', Boolean(isError));
  }

  enableButton.disabled = false;
  disableButton.disabled = false;
  enableButton.addEventListener('click', function () {
    var saved = control.setOwnerExcluded(true);
    render(
      saved ? '設定しました。このブラウザからの今後のアクセスは計測されません。' :
        '設定を保存できませんでした。通常モードやサイトデータを保存できるブラウザで、もう一度お試しください。',
      !saved
    );
  });
  disableButton.addEventListener('click', function () {
    var removed = control.setOwnerExcluded(false);
    render(
      removed ? '除外を解除しました。通常ページでは保存済みのCookie設定に従って計測されます。' :
        '除外設定を解除できませんでした。ブラウザのサイトデータ設定をご確認ください。',
      !removed
    );
  });

  render();
})();
