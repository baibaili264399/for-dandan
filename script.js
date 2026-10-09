/* =========================================================================
 *  script.js  ——  交互逻辑
 *  一般不用改这里；要改文案请改 content.js
 * ========================================================================= */
(function () {
  'use strict';

  const $  = (id) => document.getElementById(id);

  /* ---------- 元素 ---------- */
  const cover      = $('cover');
  const board      = $('board');
  const grid       = $('grid');
  const topbar     = $('topbar');
  const openBtn    = $('openBtn');
  const modal      = $('modal');
  const modalScroll= $('modalScroll');
  const mImage     = $('mImage');
  const mCaption   = $('mCaption');
  const mNum       = $('mNum');
  const mNum2      = $('mNum2');
  const mKicker    = $('mKicker');
  const mTitle     = $('mTitle');
  const mText      = $('mText');
  const mIndex     = $('mIndex');
  const prevBtn    = $('prevBtn');
  const nextBtn    = $('nextBtn');
  const backBtn    = $('backBtn');
  const closeBtn   = $('modalClose');
  const modalCard  = document.querySelector('.modal-card');
  const heartBtn   = $('heartBtn');
  const heartCount = $('heartCount');
  const musicBtn   = $('musicBtn');
  const reloadBtn  = $('reloadBtn');
  const shuffleBtn = $('shuffleBtn');
  const toastEl    = $('toast');
  const bgm        = $('bgm');

  const cfg   = (typeof CONFIG === 'object' && CONFIG) ? CONFIG : {};
  const cards = Array.isArray(typeof CARDS !== 'undefined' ? CARDS : null) ? CARDS : [];

  let current  = -1;                  // 当前打开第几张
  const seen   = new Set();           // 看过的
  let heartN   = 0;
  let eggShown = false;
  let toastTimer = null;

  /* ---------- 文案填充 ---------- */
  function fillCopy() {
    const set = (el, val) => { if (el && typeof val === 'string') el.textContent = val; };
    set($('coverTo'),    cfg.coverTo);
    set($('coverTitle'), cfg.coverTitle);
    set($('coverSub'),   cfg.coverSub);
    set($('coverHint'),  cfg.coverHint);
    set($('boardTitle'), cfg.boardTitle);
    set($('boardSub'),   cfg.boardSub);
    if (cfg.coverTitle) document.title = cfg.coverTitle;
  }

  /* ---------- 小提示 ---------- */
  function toast(msg, ms) {
    if (!toastEl || !msg) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-show'), ms || 2600);
  }

  /* ---------- 渲染九宫格 ---------- */
  function renderGrid() {
    if (!grid) return;
    grid.innerHTML = '';

    if (!cards.length) {
      const warn = document.createElement('p');
      warn.style.cssText = 'grid-column:1/-1;text-align:center;color:#8a7c74;padding:40px 0;';
      warn.textContent = '没有读到卡片内容，请检查 content.js 里的 CARDS 是不是写错了。';
      grid.appendChild(warn);
      return;
    }

    cards.forEach((card, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.style.animationDelay = (i * 62 + 60) + 'ms';
      btn.setAttribute('aria-label', '第 ' + (card.num != null ? card.num : i + 1) + ' 格：' + (card.title || ''));
      btn.dataset.index = String(i);

      const inner = document.createElement('div');
      inner.className = 'card-inner';

      const spot = document.createElement('div');
      spot.className = 'spot';
      const label = card.num != null && card.num !== '' ? String(card.num) : String(i + 1);
      spot.dataset.len = String(label.length);      /* 给 CSS 判断字号用 */
      const num = document.createElement('span');
      num.className = 'spot-num';
      if (!/^\d+$/.test(label)) num.classList.add('spot-num--text');   /* 汉字标签小一号 */
      num.textContent = label;
      spot.appendChild(num);

      inner.appendChild(spot);

      if (card.hint) {
        const hint = document.createElement('p');
        hint.className = 'card-hint';
        hint.textContent = card.hint;
        inner.appendChild(hint);
      }

      btn.appendChild(inner);
      btn.addEventListener('click', () => openCard(i));
      grid.appendChild(btn);
    });

    updateProgress();
  }

  /* ---------- 进入九宫格 ---------- */
  let entered = false;
  function enterBoard() {
    if (entered) return;
    entered = true;
    if (openBtn) openBtn.classList.add('is-open');

    /* 关键：立刻把封面从布局里拿掉（hidden = display:none）。
       只做 opacity 淡出的话，封面还占着一整屏高度，
       九宫格会被推到屏幕外，中间出现一段空白，需要用户自己滚动。
       淡出交给 .cover 的动画，布局空间马上释放，九宫格顶上第一屏。 */
    cover.hidden = true;
    board.hidden = false;
    topbar.hidden = false;
    heartBtn.hidden = false;
    window.scrollTo(0, 0);

    /* 重放卡片的入场动画（数量变了也能正确编号） */
    requestAnimationFrame(() => {
      board.querySelectorAll('.card').forEach((c, i) => {
        c.style.animation = 'none';
        void c.offsetWidth;
        c.style.animation = '';
        c.style.animationDelay = (i * 62 + 60) + 'ms';
      });
      if (cfg.welcomeToast) toast(cfg.welcomeToast, 3400);
    });
  }

  /* 清掉「纯文字大字」的样式，免得串到别的格子 */
  function clearPlainStyle() {
    const body = mText.closest('.modal-body');
    if (body) body.classList.remove('is-plain');
    mText.classList.remove('is-plain');
  }

  /* ---------- 打开某一张 ---------- */
  /* 顶部那行小标：normal = 第 N 个答案；options = 关于我 / 挑一个 */
  function setKicker(mode, n, name) {
    if (!mKicker) return;
    if (mode === 'options') {
      /* 选项页：椭圆里已经写了「关于我」，这里就不再重复 */
      mKicker.textContent = '挑一个你最想知道的';
    } else if (mode === 'detail') {
      mKicker.textContent = (name || '') + ' · 第 ' + n + ' 个';
    } else {
      mKicker.textContent = '';
      mKicker.appendChild(document.createTextNode('第 '));
      const b = document.createElement('b');
      b.textContent = String(n);
      mKicker.appendChild(b);
      mKicker.appendChild(document.createTextNode(' 个答案'));
    }
  }

  function renderFooter(backShow, navShow) {
    const back = $('backBtn');
    const idx  = $('mIndex');
    if (back) back.hidden = !backShow;
    if (idx)  idx.style.display = navShow ? '' : 'none';
    prevBtn.style.display = navShow ? '' : 'none';
    nextBtn.style.display = navShow ? '' : 'none';
  }

  /* 弹层左上角那个小椭圆：纯数字用小号手写体，汉字自动撑宽 */
  function setMiniSpot(label) {
    const s = String(label == null ? '' : label);
    mNum.textContent = s;
    mNum.classList.toggle('is-wide', !/^\d+$/.test(s));
  }

  /* 画一个方框选项 */
  function buildOptionBox(op, i, onPick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'opt';
    b.style.animationDelay = (i * 70 + 90) + 'ms';
    b.setAttribute('aria-label', (op.title || op.label || '') + '');

    const label = String(op.label != null && op.label !== '' ? op.label : i + 1);
    const text  = document.createElement('span');
    text.className = 'opt-text' + (/^\d+$/.test(label) ? ' opt-text--num' : '');
    text.textContent = label;
    b.appendChild(text);

    if (op.title) {
      const cap = document.createElement('span');
      cap.className = 'opt-cap';
      cap.textContent = op.title;
      b.appendChild(cap);
    }
    if (onPick) b.addEventListener('click', onPick);
    return b;
  }

  function openCard(i) {
    const card = cards[i];
    if (!card) return;
    current = i;
    optionView = -1;
    clearPlainStyle();

    const isOptions = card.layout === 'options' && Array.isArray(card.options) && card.options.length;

    modalCard.classList.toggle('is-options', isOptions);
    backBtn.hidden = true;
    renderFooter(false, !isOptions);

    if (isOptions) {
      /* 先只出方框选项，不显示图片和大标题 */
      mImage.removeAttribute('src');
      mImage.parentElement.hidden = true;
      mImage.parentElement.classList.remove('is-empty', 'is-cover');
      mCaption.textContent = '';
      setMiniSpot(card.num != null && card.num !== '' ? card.num : i + 1);
      setKicker('options', i + 1, card.title || '');
      mTitle.textContent = '';
      mTitle.style.display = 'none';
      renderOptions(card);
    } else {
      mTitle.style.display = '';
      /* 小椭圆要跟着这一格的标签走（原来漏了这一行，会一直显示上一次的值） */
      setMiniSpot(card.num != null && card.num !== '' ? card.num : i + 1);
      setKicker('normal', i + 1, '');
      renderCardContent(card, i);
    }

    mIndex.textContent = (isOptions ? '共 ' + card.options.length + ' 个选项' : (i + 1) + ' / ' + cards.length);
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === cards.length - 1;

    modal.hidden = false;
    document.body.classList.add('is-locked');
    modalScroll.scrollTop = 0;

    seen.add(i);
    const cardEl = grid.querySelector('.card[data-index="' + i + '"]');
    if (cardEl) cardEl.classList.add('is-seen');
    updateProgress();

    setTimeout(() => closeBtn.focus(), 60);
  }

  /* 普通图文内容 */
  /* 普通图文内容；opts.plain = true 表示「纯文字大字」，连图片位都不要 */
  function renderCardContent(card, i, opts) {
    const plain = !!(opts && opts.plain);
    const isOptionDetail = !!(opts && opts.isOptionDetail);
    const fig = mImage.parentElement;
    const body = mText.closest('.modal-body');

    body.classList.toggle('is-plain', plain);
    mText.classList.toggle('is-plain', plain);

    if (plain) {
      mImage.removeAttribute('src');
      fig.hidden = true;
      fig.classList.add('is-empty');
      fig.classList.remove('is-cover');
      mCaption.textContent = '';
    } else {
      fig.hidden = false;
      if (card.image) {
        mImage.src = card.image;
        mImage.alt = card.title ? card.title : ('第 ' + (i + 1) + ' 格图片');
        mImage.style.visibility = '';
        fig.classList.remove('is-empty');
        fig.classList.toggle('is-cover', card.fit === 'cover');   /* 默认完整显示 */
      } else {
        mImage.removeAttribute('src');
        fig.classList.add('is-empty');
        fig.classList.remove('is-cover');
      }
      mCaption.textContent = card.caption || '';
    }

    mTitle.textContent = card.title || '';

    mText.innerHTML = '';
    mText.className = 'modal-text';
    const paras = Array.isArray(card.text) ? card.text : (card.text ? [card.text] : []);
    paras.forEach((p) => {
      const el = document.createElement('p');
      el.textContent = p;
      mText.appendChild(el);
    });

    /* 最后一格带上署名；方框选项的正文里不加，免得重复 */
    if (!isOptionDetail && i === cards.length - 1 && card.layout !== 'options' && (cfg.signature || cfg.date)) {
      const sign = document.createElement('div');
      sign.className = 'modal-sign';
      sign.textContent = cfg.signature || '';
      if (cfg.date) {
        const d = document.createElement('span');
        d.textContent = cfg.date;
        sign.appendChild(d);
      }
      mText.appendChild(sign);
    }
  }

  /* 方框选项列表 */
  let optionView = -1;
  function renderOptions(card) {
    clearPlainStyle();
    mText.innerHTML = '';
    mText.className = 'modal-text is-options';
    const wrap = document.createElement('div');
    wrap.className = 'opts';
    card.options.forEach((op, k) => {
      wrap.appendChild(buildOptionBox(op, k, () => openOption(k)));
    });
    mText.appendChild(wrap);
    renderFooter(false, false);
    optionView = -1;
  }

  /* 打开某个方框 */
  function openOption(k) {
    const card = cards[current];
    if (!card || !Array.isArray(card.options)) return;
    const op = card.options[k];
    if (!op) return;
    optionView = k;

    renderCardContent(op, current, { isOptionDetail: true, plain: op.plain === true });
    setMiniSpot(op.label != null && op.label !== '' ? op.label : k + 1);
    setKicker('detail', k + 1, card.title || '');    mIndex.textContent = '第 ' + (k + 1) + ' 个 · 共 ' + card.options.length + ' 个';
    renderFooter(true, false);
    modalScroll.scrollTop = 0;
  }

  /* 从某个方框退回选项列表 */
  function backToOptions() {
    if (current < 0) return;
    const card = cards[current];
    if (!card || card.layout !== 'options') return;
    optionView = -1;
    clearPlainStyle();
    mImage.removeAttribute('src');
    mImage.parentElement.hidden = true;
    mImage.parentElement.classList.remove('is-empty', 'is-cover');
    mCaption.textContent = '';
    mTitle.textContent = '';
    mTitle.style.display = 'none';
    setMiniSpot(card.num != null && card.num !== '' ? card.num : current + 1);
    setKicker('options', current + 1, card.title || '');
    mIndex.textContent = '共 ' + card.options.length + ' 个选项';
    renderOptions(card);
    modalScroll.scrollTop = 0;
    closeBtn.focus();
  }

  function closeCard() {
    const wasOpen = current;
    modal.hidden = true;
    document.body.classList.remove('is-locked');
    current = -1;
    if (wasOpen >= 0) {
      const cardEl = grid.querySelector('.card[data-index="' + wasOpen + '"]');
      if (cardEl) cardEl.focus();
    }
  }

  function step(delta) {
    if (current < 0) return;
    const next = current + delta;
    if (next < 0 || next >= cards.length) return;
    openCard(next);
  }

  function updateProgress() {
    const el = $('progressText');
    if (!el) return;
    el.textContent = '已经点开 ' + seen.size + ' / ' + cards.length;
    if (seen.size === cards.length && cards.length) {
      el.textContent += ' · 都看完了';
    }
  }

  /* ---------- 事件绑定 ---------- */
  if (openBtn) openBtn.addEventListener('click', enterBoard);

  closeBtn.addEventListener('click', closeCard);
  modal.querySelector('[data-close]').addEventListener('click', closeCard);
  prevBtn.addEventListener('click', () => step(-1));
  nextBtn.addEventListener('click', () => step(1));
  backBtn.addEventListener('click', backToOptions);

  document.addEventListener('keydown', (e) => {
    if (!modal.hidden) {
      if (e.key === 'Escape') closeCard();
      if (e.key === 'ArrowRight') step(1);
      if (e.key === 'ArrowLeft') step(-1);
    } else if (e.key === 'Enter' && !cover.hidden) {
      enterBoard();
    }
  });

  /* 键盘左右键也能在格子里切换焦点 */
  grid.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const all = Array.from(grid.querySelectorAll('.card'));
    const at = all.indexOf(document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    all[(at + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length].focus();
  });

  /* ---------- 爱心 ---------- */
  heartBtn.hidden = true;
  heartBtn.addEventListener('click', () => {
    heartN += 1;
    heartCount.textContent = String(heartN);
    if (heartN >= (cfg.heartGoal || 10)) {
      heartBtn.classList.add('is-full');
      if (!eggShown && typeof EASTER_EGG === 'object' && EASTER_EGG) {
        eggShown = true;
        toast(EASTER_EGG.toast || '你在呀。', 4800);
        setTimeout(() => {
          if (EASTER_EGG.title || EASTER_EGG.lines) {
            clearPlainStyle();
            mImage.removeAttribute('src');
            mImage.parentElement.hidden = true;
            mImage.parentElement.classList.remove('is-empty', 'is-cover');
            mCaption.textContent = '';
            setMiniSpot('♥');
            mNum2.textContent = String(heartN);
            mKicker.textContent = '给我自己的彩蛋';
            modalCard.classList.remove('is-options');       /* 别继承选项页的样式 */
            mTitle.style.display = '';
            mTitle.textContent = EASTER_EGG.title || '';
            mText.className = 'modal-text is-center';
            mText.innerHTML = '';
            (EASTER_EGG.lines || []).forEach((p) => {
              const el = document.createElement('p');
              el.textContent = p;
              mText.appendChild(el);
            });
            mIndex.textContent = '彩蛋';
            backBtn.hidden = true;
            renderFooter(false, false);
            current = -1;
            modal.hidden = false;
            document.body.classList.add('is-locked');
            modalScroll.scrollTop = 0;
          }
        }, 2400);
      }
    }
  });

  /* ---------- 音乐 ---------- */
  bgm.volume = typeof cfg.musicVolume === 'number' ? cfg.musicVolume : 0.45;
  let playing = false;

  musicBtn.addEventListener('click', () => {
    if (!bgm.getAttribute('src') && !bgm.querySelector('source')) return;
    if (playing) {
      bgm.pause();
      playing = false;
      musicBtn.classList.remove('is-on');
      musicBtn.textContent = '♪ 音乐';
      return;
    }
    const p = bgm.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        playing = true;
        musicBtn.classList.add('is-on');
        musicBtn.textContent = '♪ 播放中';
      }).catch(() => {
        toast('还没放音乐文件。把 mp3 放到 music/music.mp3 就能播了。', 4200);
      });
    }
  });

  /* ---------- 随机 / 重载 ---------- */
  shuffleBtn.addEventListener('click', () => {
    if (!cards.length) return;
    openCard(Math.floor(Math.random() * cards.length));
  });

  reloadBtn.addEventListener('click', () => {
    let ok = true;
    try {
      if (typeof CONFIG === 'object' && CONFIG) Object.assign(cfg, CONFIG);
    } catch (err) { ok = false; }
    try {
      if (typeof CARDS !== 'undefined' && Array.isArray(CARDS)) {
        cards.splice(0, cards.length, ...CARDS);
      }
    } catch (err) { ok = false; }

    document.body.classList.remove('is-locked');
    modal.hidden = true;
    current = -1;
    seen.clear();
    renderGrid();
    toast(ok ? '文案已重新载入。' : '重载时有点小问题，看下控制台。', 2200);
  });

  /* ---------- 鼠标轻微视差 ---------- */
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    grid.addEventListener('mousemove', (e) => {
      const el = e.target.closest('.card');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = 'translateY(-7px) rotateX(' + (-y * 5).toFixed(2) + 'deg) rotateY(' + (x * 6).toFixed(2) + 'deg)';
    });
    grid.addEventListener('mouseleave', () => {
      grid.querySelectorAll('.card').forEach((c) => { c.style.transform = ''; });
    });
    grid.addEventListener('mouseout', (e) => {
      const el = e.target.closest('.card');
      if (el && !el.contains(e.relatedTarget)) el.style.transform = '';
    });
  }

  /* =====================================================================
   *  收尾页：小树长大 → 姻缘牌 → 孔明灯
   * =================================================================== */
  const F = (typeof FINALE === 'object' && FINALE) ? FINALE : {};
  const lanternWords = (typeof LANTERNS !== 'undefined' && Array.isArray(LANTERNS)) ? LANTERNS.slice() : [];

  const finaleEl     = $('finale');
  const finaleCta    = $('finaleCta');
  const finaleClose  = $('finaleClose');
  const finaleReplay = $('finaleReplay');
  const finaleBack   = $('finaleBack');
  const finaleFoot   = $('finaleFoot');
  const finaleHint   = $('finaleHint');
  const lanternLayer = $('lanternLayer');
  const plaqueEl     = $('plaque');
  const treeSvg      = $('tree');
  const leavesG      = $('leaves');
  const starsBox     = $('stars');

  /* 叶子的位置：贴着树枝、填满树冠（坐标跟 SVG 的 viewBox 对应） */
  const LEAF_SPOTS = [
    /* 五根树枝上 */
    [420, 585], [452, 558], [482, 528], [508, 498], [524, 468],
    [356, 634], [322, 606], [288, 578], [258, 548],
    [412, 502], [432, 464], [452, 426], [472, 392],
    [362, 528], [338, 486], [316, 450], [302, 424],
    [393, 436], [394, 398], [395, 360], [396, 336],
    /* 树冠填空 */
    [330, 350], [362, 330], [400, 318], [438, 332], [470, 356], [500, 392], [530, 428], [556, 462],
    [300, 392], [276, 430], [262, 478], [272, 520], [300, 556], [336, 584],
    [372, 600], [414, 592], [452, 570], [486, 540], [516, 506], [540, 470],
    [346, 392], [382, 368], [420, 382], [456, 412], [484, 448], [508, 486]
  ];

  let finaleTimers = [];
  let lanternTimer = null;
  let lanternIdx = 0;

  function later(fn, ms) { finaleTimers.push(setTimeout(fn, ms)); }
  function clearFinaleTimers() {
    finaleTimers.forEach(clearTimeout);
    finaleTimers = [];
    if (lanternTimer) { clearInterval(lanternTimer); lanternTimer = null; }
  }

  /* 树枝「长」出来：量出每条路径的长度，做成虚线偏移 */
  function prepareTree() {
    if (!treeSvg) return;
    treeSvg.querySelectorAll('.trunk, .trunk-hl, .branch').forEach((p) => {
      const len = p.getTotalLength ? p.getTotalLength() : 0;
      if (!len) return;
      p.style.strokeDasharray = len + ' ' + len;
      p.style.strokeDashoffset = len;
    });
  }
  function growTree() {
    if (!treeSvg) return;
    treeSvg.querySelectorAll('.trunk, .trunk-hl, .branch').forEach((p) => { p.style.strokeDashoffset = '0'; });
  }

  function buildLeaves() {
    if (!leavesG || leavesG.childElementCount) return;
    const NS = 'http://www.w3.org/2000/svg';
    const addLeaf = (cx, cy, rx, ry, rot, delay, dark) => {
      const el = document.createElementNS(NS, 'ellipse');
      el.setAttribute('cx', cx);
      el.setAttribute('cy', cy);
      el.setAttribute('rx', rx);
      el.setAttribute('ry', ry);
      el.setAttribute('transform', 'rotate(' + rot + ' ' + cx + ' ' + cy + ')');
      el.setAttribute('class', dark ? 'leaf leaf-dark' : 'leaf');
      el.style.animationDelay = delay.toFixed(2) + 's';
      leavesG.appendChild(el);
    };

    LEAF_SPOTS.forEach((spot, i) => {
      const cx = spot[0], cy = spot[1];
      const rot = ((i * 37) % 70) - 35;
      addLeaf(cx, cy, 17 + (i % 3) * 2, 8.5 + (i % 2) * 2, rot, 2 + i * 0.04, false);
      /* 一半的位置再叠一片深色小叶，看起来更厚实 */
      if (i % 2 === 0) {
        addLeaf(cx + 9, cy + 13, 12, 6.5, rot + 62, 2.35 + i * 0.04, true);
      }
    });
  }

  function buildStars() {
    if (!starsBox || starsBox.childElementCount) return;
    for (let i = 0; i < 46; i++) {
      const s = document.createElement('i');
      s.className = 'star';
      s.style.left = (Math.random() * 100).toFixed(2) + '%';
      s.style.top = (Math.random() * 62).toFixed(2) + '%';
      s.style.setProperty('--sz', (1 + Math.random() * 2.2).toFixed(1) + 'px');
      s.style.animationDelay = (Math.random() * 3.4).toFixed(2) + 's';
      starsBox.appendChild(s);
    }
  }

  function openFinale() {
    if (!finaleEl) return;
    clearFinaleTimers();
    buildStars();
    prepareTree();
    buildLeaves();

    if (finaleHint) { finaleHint.hidden = false; finaleHint.textContent = F.hintPlanting || '小树在长……'; }
    if (finaleFoot) finaleFoot.hidden = true;
    if (lanternLayer) lanternLayer.innerHTML = '';
    if (plaqueEl) plaqueEl.classList.remove('is-ready', 'is-pressed');

    finaleEl.hidden = false;
    document.body.classList.add('is-locked');
    requestAnimationFrame(() => finaleEl.classList.add('is-open'));

    later(() => finaleEl.classList.add('is-growing'), 140);
    later(growTree, 260);
    later(() => {
      if (plaqueEl) plaqueEl.classList.add('is-ready');
      if (finaleHint) finaleHint.textContent = F.hintClickPlaque || '点一下那块牌子';
    }, 3500);
  }

  function closeFinale() {
    if (!finaleEl) return;
    clearFinaleTimers();
    finaleEl.classList.remove('is-open', 'is-growing');
    document.body.classList.remove('is-locked');
    if (lanternLayer) lanternLayer.innerHTML = '';
    setTimeout(() => { finaleEl.hidden = true; }, 620);
  }

  /* 让灯从左到右依次升起，横向均匀分布，避免全挤在一侧 */
  function lanternLeft(index, total) {
    const span = 78;                                   /* 横向只用 6% ~ 84%，两侧留白 */
    const slot = span / Math.max(total, 1);
    const jitter = (Math.random() * 0.5 - 0.25) * slot; /* 每盏再抖一点点，不显得呆板 */
    return (6 + (index + 0.5) * slot + jitter).toFixed(1) + '%';
  }

  function makeLantern(text, index, total) {
    const d = document.createElement('div');
    d.className = 'lantern';
    d.style.left = lanternLeft(index, total);
    /* 起点高度分三档错开，相邻的灯不会挤在一起 */
    d.style.bottom = (-200 - (index % 3) * 230) + 'px';
    d.style.setProperty('--dur', (13 + Math.random() * 6).toFixed(1) + 's');
    d.style.setProperty('--drift', (Math.random() * 80 - 40).toFixed(0) + 'px');
    d.style.setProperty('--scale', (0.8 + Math.random() * 0.25).toFixed(2));
    d.innerHTML = '<span class="lantern-body"><span class="lantern-text"></span></span><span class="lantern-flame"></span>';

    /* 在逗号处换行：一句话里的「，」变成一次断行，不会把词从中间切断 */
    const holder = d.querySelector('.lantern-text');
    String(text).split(/[，,]/).filter((s) => s.trim()).forEach((part) => {
      const line = document.createElement('span');
      line.textContent = part.trim();
      holder.appendChild(line);
    });
    return d;
  }

  /* 一盏一盏放灯 */
  function releaseLanterns() {
    if (!lanternLayer || lanternTimer) return;
    lanternLayer.innerHTML = '';
    lanternIdx = 0;
    const words = lanternWords.length ? lanternWords : ['丹丹，我一直都在'];

    const step = () => {
      lanternLayer.appendChild(makeLantern(words[lanternIdx % words.length], lanternIdx, words.length));
      lanternIdx += 1;
      if (lanternIdx >= words.length) {
        if (lanternTimer) { clearInterval(lanternTimer); lanternTimer = null; }
        later(() => { if (finaleFoot) finaleFoot.hidden = false; }, 1400);
      }
    };

    step();
    lanternTimer = setInterval(step, 1150);
  }

  if (finaleCta) {
    const ctaText = $('ctaText'), ctaSub = $('ctaSub');
    if (ctaText && F.ctaText) ctaText.textContent = F.ctaText;
    if (ctaSub && F.ctaSub) ctaSub.textContent = F.ctaSub;
    finaleCta.addEventListener('click', openFinale);
  }
  if (finaleClose) finaleClose.addEventListener('click', closeFinale);
  if (finaleBack) finaleBack.addEventListener('click', closeFinale);
  if (finaleReplay) {
    if (F.replayText) finaleReplay.textContent = F.replayText;
    finaleReplay.addEventListener('click', () => {
      if (finaleFoot) finaleFoot.hidden = true;
      if (lanternTimer) { clearInterval(lanternTimer); lanternTimer = null; }
      releaseLanterns();
    });
  }
  if (finaleBack && F.backText) finaleBack.textContent = F.backText;

  if (plaqueEl) {
    const hitPlaque = () => {
      if (!plaqueEl.classList.contains('is-ready')) return;   /* 牌子还没挂好 */
      plaqueEl.classList.add('is-pressed');
      setTimeout(() => plaqueEl.classList.remove('is-pressed'), 340);
      if (finaleHint) finaleHint.hidden = true;
      releaseLanterns();
    };
    plaqueEl.addEventListener('click', hitPlaque);
    plaqueEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); hitPlaque(); }
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && finaleEl && !finaleEl.hidden) closeFinale();
  });

  /* ---------- 启动 ---------- */
  fillCopy();
  renderGrid();

  /* 支持用网址直接打开某一张，方便分享和调试：
     .../index.html#card=3  → 直接展示第 3 张
     .../index.html#board   → 跳过封面，直接看九宫格 */
  function applyHash() {
    const h = location.hash || '';
    const m = /#card=(\d+)/.exec(h);
    if (!m && h.indexOf('#board') !== 0) return;

    entered = true;
    cover.hidden = true;
    board.hidden = false;
    topbar.hidden = false;
    heartBtn.hidden = false;

    if (m) {
      const i = parseInt(m[1], 10) - 1;
      if (i >= 0 && i < cards.length) openCard(i);
    }
  }
  applyHash();
  window.addEventListener('hashchange', applyHash);
})();
