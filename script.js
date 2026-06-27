const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.nav');

menuButton.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
});

nav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  });
});

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

const prizes = [
  { emoji: '🌟', text: 'きらめきスター' },
  { emoji: '🐈', text: '幸運の宇宙ねこ' },
  { emoji: '🍮', text: 'ごほうびプリン' },
  { emoji: '🌈', text: '小さなレインボー' },
  { emoji: '🎈', text: 'ふわふわバルーン' },
];
const gachaButton = document.querySelector('#gachaButton');
const gachaMachine = document.querySelector('#gachaMachine');
const resultEmoji = document.querySelector('#resultEmoji');
const resultText = document.querySelector('#resultText');

gachaButton.addEventListener('click', () => {
  if (gachaMachine.classList.contains('is-spinning')) return;
  gachaMachine.classList.add('is-spinning');
  resultEmoji.textContent = '…';
  resultText.textContent = '抽選中…';
  gachaButton.disabled = true;
  window.setTimeout(() => {
    const prize = prizes[Math.floor(Math.random() * prizes.length)];
    resultEmoji.textContent = prize.emoji;
    resultText.textContent = prize.text;
    gachaMachine.classList.remove('is-spinning');
    gachaButton.disabled = false;
  }, 750);
});

document.querySelectorAll('.category-tabs button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelector('.category-tabs button.active').classList.remove('active');
    button.classList.add('active');
    const category = button.dataset.category;
    document.querySelectorAll('.item-card').forEach((card) => {
      card.hidden = category !== 'all' && card.dataset.category !== category;
    });
  });
});
