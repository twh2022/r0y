/* ============================================================
   AI 합동 비서실 — app.js
   저장: localStorage (기본) / Firebase Realtime Database (선택)
   ============================================================ */
(() => {
  'use strict';

  /* ---------------- 1. 에이전트 정의 ---------------- */
  const AGENTS = [
    {
      id: 'Roy', name: 'Roy', role: '외부 팩트 · 리스크 · 브리핑',
      color: '#7ee787',
      lines: [
        'NQ −1.5% 이탈 — 신규 매수 차단합니다.',
        '업비트 원화마켓 최소 주문 5,000원 확인했어요.',
        'API 키는 출금 권한 없이 발급하는 게 원칙입니다.',
        '스펙 변경은 416회 백테스트로 검증합니다.'
      ]
    },
    {
      id: 'ChatGPT', name: 'ChatGPT', role: '구조 · 논리 검토',
      color: '#2ee6a8',
      lines: [
        '805/805 감사는 코드 검증이지 수익성 검증은 아닙니다.',
        '416회 변형 탐색은 선택 편향을 먼저 점검해야 해요.',
        '재시작 시 포지션 동기화부터 확인하죠.',
        '레버리지·마틴게일은 제외하는 쪽으로 정리했으면 합니다.'
      ]
    },
    {
      id: 'Muse', name: 'Muse', role: '리서치 · 비교 분석',
      color: '#b18cff',
      lines: [
        '코인에 −5% 손절을 그대로 쓰면 손절만 잦아져요.',
        '비용 0.10% → 0.30% 민감도가 궁금합니다.',
        '슬롯 점수 상한이 없어 NVDA가 슬롯을 독점할 수 있어요.',
        '모의 2주는 돌려보고 판단하는 게 맞아요.'
      ]
    },
    {
      id: 'Gemini', name: 'Gemini', role: '시황 · 멀티 관점',
      color: '#4c9aff',
      lines: [
        'VIX 30 이상이면 관망이 답입니다.',
        '강세장 편향을 빼고 하락 구간도 봐야죠.',
        '거래소 수수료 실측치로 다시 계산해볼게요.',
        '멀티 관점에서는 보수적으로 가는 게 맞습니다.'
      ]
    }
  ];
  const AGENT_IDS = AGENTS.map(a => a.id);
  const STATUSES = ['대기 중', '검토 중', '발언 완료'];

  /* ---------------- 2. 픽셀 스프라이트 ---------------- */
  const SPRITE_MAP = {
    Roy: [
      '......dd........',
      '..llllllllllll..',
      '..ggeeggggeegg..',
      '..gggggggggggg..',
      '..........gggg..',
      '..........gggg..',
      '..........dddd..',
      '..llllllllllll..',
      '..gggggggggggg..',
      '..dddddddddddd..',
      '..gggg..........',
      '..gggg..........',
      '..dddd..........',
      '..llllllllllll..',
      '..dddddddddddd..',
      '................'
    ],
    ChatGPT: [
      '................',
      '......gggg......',
      '....gggggggg....',
      '...gggggggggg...',
      '..gggggggggggg..',
      '..gggggggggggg..',
      '..ggeeggggeegg..',
      '..gggggggggggg..',
      '..gggggggggggg..',
      '..gggeeeeggggg..',
      '..gggggggggggg..',
      '..dddddddddddd..',
      '...gggggggggg...',
      '....gggggggg....',
      '................',
      '................'
    ],
    Muse: [
      '.......dd.......',
      '....dddddddd....',
      '...dddddddddd...',
      '..gllllllllllg..',
      '..ggeeggggeegg..',
      '..gggggggggggg..',
      '..gggggggggggg..',
      '..gggggggggggg..',
      '..gggeeeeggggg..',
      '..gggggggggggg..',
      '..gggggggggggg..',
      '..dddddddddddd..',
      '...gggggggggg...',
      '....gggggggg....',
      '................',
      '................'
    ],
    Gemini: [
      '.......gg.......',
      '.......gg.......',
      '......gggg......',
      '......gggg......',
      '...gggggggggg...',
      '..ggeeggggeegg..',
      '..gggggeeggggg..',
      '..gggggggggggg..',
      '...gggggggggg...',
      '......gggg......',
      '......gggg......',
      '.......gg.......',
      '.......gg.......',
      '................',
      '................',
      '................'
    ]
  };
  const PALETTE = {
    Roy:     { g: '#7ee787', d: '#3f8f4a', l: '#b6f5b8', e: '#0b1017' },
    ChatGPT: { g: '#2ee6a8', d: '#128a68', l: '#8ff5dc', e: '#062018' },
    // Muse 는 모자(d)가 본체와 구분되도록 색을 바꿔 쓴다
    Muse:    { g: '#b18cff', d: '#4d2e8f', l: '#dccdff', e: '#150a28' },
    Gemini:  { g: '#4c9aff', d: '#255db0', l: '#b9d7ff', e: '#04121f' }
  };
  // Muse 의 d 는 모자와 그림자 두 곳에 쓰이므로 모자 전용 키 'h' 를 따로 둔다
  const PALETTE_EXTRA = { Muse: { h: '#7a5cd6' } };

  function drawSprite(canvas, id) {
    if (!canvas) return;
    const rows = SPRITE_MAP[id];
    const pal = Object.assign({}, PALETTE[id], PALETTE_EXTRA[id] || {});
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y++) {
      const row = rows[y] || '';
      for (let x = 0; x < 16; x++) {
        const ch = row[x];
        if (!ch || ch === '.') continue;
        const color = pal[ch] || pal.g;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  // Muse 모자 줄(d)만 밝게: 윗줄 3줄을 h 로 다시 그린다
  function drawMuseHat(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = PALETTE_EXTRA.Muse.h;
    [[0, 7, 2], [1, 4, 8], [2, 3, 10]].forEach(([y, x0, w]) => ctx.fillRect(x0, y, w, 1));
  }

  /* ---------------- 3. 상태 ---------------- */
  const LS_KEY = 'ai-office-state-v1';
  const DB_KEY = 'ai-office-db-url';
  const nowStamp = () => {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  function seedState() {
    const t = nowStamp();
    return {
      version: 1,
      updatedAt: 0,
      agents: { Roy: '발언 완료', ChatGPT: '발언 완료', Muse: '검토 중', Gemini: '대기 중' },
      activeAgent: 'Roy',
      activeAgenda: 'ag-alpha',
      botStep: 2,
      agendas: [
        {
          id: 'ag-alpha',
          title: 'ALPHA SHIELD v3.2 현행 유지 및 점검 포인트',
          desc: '미국장 자동매매 전략 6-1-F 현행 체제(2026-11-27 기준)를 그대로 유지할지, 점검 포인트를 먼저 반영할지 결정하는 안건. Roy·Muse 1차 검토 요약 포함.',
          tags: ['전략 스펙', '미국장', '현행 유지'],
          createdAt: t,
          votes: { Roy: '찬성', Muse: '찬성', ChatGPT: '찬성', Gemini: '보류' },
          opinions: [
            { id: 'o1', agent: 'Roy', ts: t, text: '강점 3\n① 2슬롯 고정 · 현금 버퍼 · 최소 주문으로 소액 계좌의 과노출을 구조적으로 차단\n② 시세 지연·SMA200 미확인 시 매수만 막는 비대칭 fail-closed\n③ 52변형 416회 백테스트 + 805/805 전수 감사로 스펙 변경 거버넌스 확보' },
            { id: 'o2', agent: 'Roy', ts: t, text: '점검 3\n① 진입 단가에 대한 비용 0.10% 가정은 실전 소수점 슬리피지·수수료와 괴리 가능\n② 물타기 후 −3.5% 손절선의 실제 손실률(평단 기준)\n③ 실적·8-K 이벤트 가드 크로스체크' },
            { id: 'o3', agent: 'Muse', ts: t, text: '리스크·검증 포인트\n① 백테스트 표본이 작고 강세 편향일 수 있어 상승/횡보/하락 구간 분해 필요 (+48.68%, 샤프 2.05, 승률 59.4%, 126포지션)\n② 슬롯 경쟁 점수 = 알파 가중치 × (|낙폭|/|진입 임계|) 에 상한이 없어 고베타 종목이 슬롯을 독점할 수 있음\n③ 물타기 후 손절은 평단 기준이라 1차 진입가 대비 손실이 더 큼, 야간 운용 장애 대응 확인 필요\n④ 비용 0.10% → 0.20%·0.30% 민감도 분석 요청' },
            { id: 'o4', agent: 'ChatGPT', ts: t, text: '현행 유지에 조건부 찬성합니다. 다만 805/805 감사 통과는 코드 검증이지 수익성 검증이 아닙니다. 416회 변형 탐색에 따른 선택 편향, 미사용 구간 검증, 거래비용 민감도, 주문 실패 및 재시작 시 포지션 동기화 검증을 우선 제안합니다. 원본 코드와 백테스트 로그는 아직 직접 검증하지 않았습니다.' }
          ]
        },
        {
          id: 'ag-coin',
          title: '소액 계좌 코인 매매 봇 구축 방향',
          desc: '소액 계좌로 코인 자동매매 봇을 돌릴지, 돌린다면 어느 거래소·어떤 방식으로 시작할지 정하는 안건. Roy·Muse·ChatGPT 의견 요약 포함.',
          tags: ['코인', '자동매매', '보류 중'],
          createdAt: t,
          votes: { Roy: '찬성', Muse: '찬성', ChatGPT: '찬성', Gemini: '보류' },
          opinions: [
            { id: 'c1', agent: 'Muse', ts: t, text: '결론 — 돌려보는 건 찬성, 처음부터 실전·풀사이즈는 반대. 페이퍼(모의) → 소액 실전, 현물 전용이 맞아요.\n1. 코인은 24시간 장·고변동성이라 ALPHA SHIELD의 −5% 손절·−3.5% 물타기 손절을 그대로 옮기면 손절만 잦아집니다. 진입·손절 폭은 코인 변동성에 맞게 재설계해야 해요.\n2. 소액은 수수료·슬리피지 비중이 커서 주문 횟수가 적은 전략(추세·DCA)이 유리합니다.\n3. 거래소 KYC·이용 가능 여부 확인, API 키는 출금 권한 없이 거래 전용으로.' },
            { id: 'c2', agent: 'Roy', ts: t, text: '기본 입장 — 현물·저빈도·방어막이면 찬성. 선물·그리드·마틴게일은 기각.\n· 국내는 업비트 원화마켓이 1순위 — 최소 주문 5,000원, BTC/ETH/SOL 등 메이저 2~3종\n· 도구는 upbit-official/upbit-agent-skills 검토, Freqtrade는 업비트 미지원이라 모의 공부용 / 실주문은 업비트 API로 분리\n· 드라이런 최소 2주, 왕복 0.2~0.3% 비용 가정에도 성과가 버티는지 확인\n· 실전 전 필수: API 키 출금 권한 OFF, 일 최대 손실 한도, 과최적화 방지, fail-closed' },
            { id: 'c3', agent: 'ChatGPT', ts: t, text: 'Freqtrade 기반 현물 드라이런 우선 검토에 찬성합니다. 미국장 전략을 그대로 이식하는 것은 반대합니다. BTC/ETH 등 유동성 높은 시장에서 추세추종과 평균회귀를 별도 비교하고, 단순 보유 대비 비용 차감 수익률·MDD를 평가해야 합니다. 레버리지·마틴게일 제외, 출금 권한 없는 API 키, 중복 주문 방지 및 손실 한도 필수. 초기에는 실거래 없이 검증하고 통과 후에만 감당 가능한 소액으로 테스트.' }
          ]
        }
      ]
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return seedState();
      const parsed = JSON.parse(raw);
      const base = seedState();
      return Object.assign(base, parsed, { agents: Object.assign(base.agents, parsed.agents || {}) });
    } catch (e) {
      return seedState();
    }
  }

  let state = loadState();
  let saveTimer = null;
  let dirty = false;

  function persist() {
    state.updatedAt = Date.now();
    dirty = true;
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(state));
    } catch (e) { /* 용량 초과 등은 조용히 무시 */ }
    if (db.enabled) schedulePush();
    setSyncBadge(db.enabled ? 'saving' : 'local');
  }

  function touch() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 250);
  }

  /* ---------------- 4. 유틸 ---------------- */
  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const esc = str => String(str == null ? '' : str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const uid = () => 'x' + Math.random().toString(36).slice(2, 9);

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
  }

  const agentById = id => AGENTS.find(a => a.id === id) || AGENTS[0];
  const currentAgenda = () => state.agendas.find(a => a.id === state.activeAgenda) || state.agendas[0];

  function tallyOf(agenda) {
    const t = { '찬성': 0, '기각': 0, '보류': 0, none: 0 };
    AGENT_IDS.forEach(id => {
      const v = agenda.votes[id];
      if (t[v] != null) t[v] += 1; else t.none += 1;
    });
    return t;
  }

  /* ---------------- 5. 탭 ---------------- */
  function setTab(name) {
    $$('.tab').forEach(t => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $$('.panel').forEach(p => {
      const on = p.id === 'panel-' + name;
      p.classList.toggle('is-active', on);
      p.hidden = !on;
    });
    if (name === 'meeting') renderMeeting();
    if (name === 'work') renderWork();
    if (name === 'office') startOfficeLoop(true);
  }
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    setTab(t.dataset.tab);
    history.replaceState(null, '', '#' + t.dataset.tab);
  }));

  /* ---------------- 6. 오피스 맵 ---------------- */
  const SPOTS = [
    [20, 62], [64, 58], [38, 95], [82, 87],
    [46, 46], [88, 50], [14, 82], [52, 76], [72, 68], [30, 42]
  ];
  let selectedAgent = state.activeAgent || 'Roy';
  let officeTimer = null;

  function initSprites() {
    AGENTS.forEach(a => {
      const el = document.querySelector(`.agent[data-agent="${a.id}"]`);
      if (!el) return;
      drawSprite(el.querySelector('canvas'), a.id);
      if (a.id === 'Muse') drawMuseHat(el.querySelector('canvas'));
      // 상태 점
      if (!el.querySelector('.status-dot')) {
        const dot = document.createElement('span');
        dot.className = 'status-dot';
        el.appendChild(dot);
      }
    });
  }

  function applyAgentStatus() {
    AGENTS.forEach(a => {
      const el = document.querySelector(`.agent[data-agent="${a.id}"]`);
      if (el) {
        el.dataset.status = state.agents[a.id] || '대기 중';
        el.setAttribute('aria-label', `${a.name} · ${state.agents[a.id] || '대기 중'} · 상태 보기`);
      }
    });
  }

  function latestOpinion(agentId) {
    let best = null;
    state.agendas.forEach(ag => {
      ag.opinions.forEach(op => {
        if (op.agent !== agentId) return;
        if (!best || (op.ts || '') >= (best.ts || '')) best = op;
      });
    });
    return best;
  }

  function agentStats(agentId) {
    let opinions = 0, votes = 0, agendas = 0;
    state.agendas.forEach(ag => {
      const mine = ag.opinions.filter(o => o.agent === agentId);
      opinions += mine.length;
      if (ag.votes[agentId]) votes += 1;
      if (mine.length || ag.votes[agentId]) agendas += 1;
    });
    return { opinions, votes, agendas };
  }

  function renderPanel() {
    const a = agentById(selectedAgent);
    $('#panelName').textContent = a.name;
    $('#panelRole').textContent = a.role;
    const st = state.agents[a.id] || '대기 중';
    const pill = $('#panelStatus');
    pill.textContent = st;
    pill.dataset.status = st;
    $$('#statusButtons .chip').forEach(c => c.classList.toggle('is-on', c.dataset.status === st));
    const op = latestOpinion(a.id);
    $('#panelRecent').textContent = op
      ? op.text.replace(/\n+/g, ' ').slice(0, 220) + (op.text.length > 220 ? '…' : '')
      : '아직 남긴 의견이 없습니다. 회의실에서 의견을 추가해 보세요.';
    const s = agentStats(a.id);
    $('#statOpinions').textContent = s.opinions;
    $('#statVotes').textContent = s.votes;
    $('#statAgenda').textContent = s.agendas;
    drawSprite($('#panelSprite'), a.id);
    if (a.id === 'Muse') drawMuseHat($('#panelSprite'));
  }

  function selectAgent(id) {
    selectedAgent = id;
    state.activeAgent = id;
    touch();
    renderPanel();
    $$('.agent').forEach(el => el.classList.toggle('is-selected', el.dataset.agent === id));
  }

  function cycleStatus(id) {
    const cur = state.agents[id] || '대기 중';
    const next = STATUSES[(STATUSES.indexOf(cur) + 1) % STATUSES.length];
    state.agents[id] = next;
    touch();
    applyAgentStatus();
    if (selectedAgent === id) renderPanel();
    toast(`${agentById(id).name} · ${next}`);
    speak(id);
  }

  function speak(id) {
    const a = agentById(id);
    const line = a.lines[Math.floor(Math.random() * a.lines.length)];
    showBubble(id, line);
  }

  function showBubble(id, text) {
    const el = document.querySelector(`.agent[data-agent="${id}"] .bubble`);
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.hidden = true; }, 4600);
  }

  function wander() {
    const el = document.querySelector('.agent');
    if (!el) return;
    const id = AGENT_IDS[Math.floor(Math.random() * AGENT_IDS.length)];
    const node = document.querySelector(`.agent[data-agent="${id}"]`);
    if (!node) return;
    let spot = SPOTS[Math.floor(Math.random() * SPOTS.length)];
    let guard = 0;
    const cur = [parseFloat(node.style.getPropertyValue('--x')), parseFloat(node.style.getPropertyValue('--y'))];
    while (Math.abs(spot[0] - cur[0]) + Math.abs(spot[1] - cur[1]) < 12 && guard++ < 8) {
      spot = SPOTS[Math.floor(Math.random() * SPOTS.length)];
    }
    node.style.setProperty('--x', spot[0] + '%');
    node.style.setProperty('--y', spot[1] + '%');
    node.classList.add('walking');
    setTimeout(() => node.classList.remove('walking'), 1600);
  }

  function startOfficeLoop(force) {
    if (officeTimer && !force) return;
    if (officeTimer) return;
    officeTimer = setInterval(() => {
      wander();
      if (Math.random() < 0.55) {
        const id = AGENT_IDS[Math.floor(Math.random() * AGENT_IDS.length)];
        speak(id);
      }
      updateClock();
    }, 5200);
  }

  function updateClock() {
    const el = $('#officeClock');
    if (!el) return;
    const d = new Date();
    el.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  $$('.agent').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.agent;
      selectAgent(id);
      cycleStatus(id);
    });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  });

  $('#statusButtons').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    state.agents[selectedAgent] = btn.dataset.status;
    touch();
    applyAgentStatus();
    renderPanel();
  });

  /* ---------------- 7. 회의실 ---------------- */
  function voteMiniHTML(ag) {
    const t = tallyOf(ag);
    const total = Math.max(1, t['찬성'] + t['기각'] + t['보류']);
    return `<div class="vote-mini">
      <i class="y" style="width:${(t['찬성'] / total) * 100}%"></i>
      <i class="n" style="width:${(t['기각'] / total) * 100}%"></i>
      <i class="h" style="width:${(t['보류'] / total) * 100}%"></i>
    </div>`;
  }

  function renderAgendaList() {
    const ul = $('#agendaList');
    ul.innerHTML = state.agendas.map(ag => {
      const t = tallyOf(ag);
      return `<li class="agenda-item ${ag.id === state.activeAgenda ? 'is-active' : ''}" data-id="${ag.id}" role="button" tabindex="0">
        <h4>${esc(ag.title)}</h4>
        <div class="meta">
          <span>의견 ${ag.opinions.length}</span>
          <span>찬 ${t['찬성']} · 기 ${t['기각']} · 보 ${t['보류']}</span>
        </div>
        ${voteMiniHTML(ag)}
      </li>`;
    }).join('');
    $('#agendaCount').textContent = state.agendas.length;
  }

  function resultLine(t) {
    const total = t['찬성'] + t['기각'] + t['보류'];
    if (!total) return '아직 투표 없음 — 4인 중 누구든 투표를 시작하세요.';
    if (t['찬성'] >= 3) return `가결 권고 — 찬성 ${t['찬성']}표 (4인 중 3표 이상)`;
    if (t['기각'] >= 3) return `부결 권고 — 기각 ${t['기각']}표 (4인 중 3표 이상)`;
    if (t['찬성'] + t['기각'] + t['보류'] < 4) return `집계 중 — ${4 - total}명 미투표`;
    return '논의 계속 — 찬성·기각 모두 3표 미만';
  }

  function renderDetail() {
    const ag = currentAgenda();
    if (!ag) {
      $('#agendaDetail').innerHTML = '<p class="empty">안건이 없습니다. 왼쪽에서 새 안건을 추가하세요.</p>';
      return;
    }
    const t = tallyOf(ag);
    const total = Math.max(1, t['찬성'] + t['기각'] + t['보류']);
    const pct = v => ((v / total) * 100).toFixed(1) + '%';

    const voters = AGENT_IDS.map(id => {
      const a = agentById(id);
      const v = ag.votes[id];
      return `<div class="voter">
        <span class="v-name" data-a="${id}">${esc(a.name)}</span>
        <div class="v-btns">
          ${['찬성', '기각', '보류'].map(x =>
            `<button class="v-btn ${v === x ? 'is-on' : ''}" data-v="${x}" data-agent="${id}" type="button">${x}</button>`
          ).join('')}
        </div>
      </div>`;
    }).join('');

    const opinions = ag.opinions.length
      ? ag.opinions.slice().sort((a, b) => String(a.ts).localeCompare(String(b.ts))).map(op => {
        const a = agentById(op.agent);
        return `<article class="opinion" data-a="${op.agent}">
          <header>
            <span class="who" data-a="${op.agent}">[${esc(a.name)}]</span>
            <span class="when">${esc(op.ts || '')}</span>
            <button class="del" data-op="${op.id}" aria-label="의견 삭제" type="button">✕</button>
          </header>
          <p>${esc(op.text)}</p>
        </article>`;
      }).join('')
      : '<p class="empty">이 안건에는 아직 의견이 없습니다.</p>';

    $('#agendaDetail').innerHTML = `
      <div class="detail-head">
        <h2>${esc(ag.title)}</h2>
        <p class="detail-desc">${esc(ag.desc || '')}</p>
        <div class="detail-tags">${(ag.tags || []).map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>
      </div>

      <div class="vote-block">
        <h3>투표 · 찬성 / 기각 / 보류</h3>
        <div class="voters">${voters}</div>
        <div class="tally">
          <div class="tally-bar">
            <i class="y" style="width:${pct(t['찬성'])}"></i>
            <i class="n" style="width:${pct(t['기각'])}"></i>
            <i class="h" style="width:${pct(t['보류'])}"></i>
          </div>
          <div class="tally-legend">
            <span><span class="k" style="background:#4ad598"></span>찬성 <b>${t['찬성']}</b></span>
            <span><span class="k" style="background:#ff7b7b"></span>기각 <b>${t['기각']}</b></span>
            <span><span class="k" style="background:#f0ce6a"></span>보류 <b>${t['보류']}</b></span>
            <span class="muted">미투표 ${t.none}</span>
          </div>
          <p class="tally-result">${resultLine(t)}</p>
        </div>
      </div>

      <div class="opinion-block">
        <h3>의견 ${ag.opinions.length}</h3>
        <div class="opinions">${opinions}</div>
        <form class="add-opinion" id="opForm">
          <h3>의견 추가</h3>
          <div class="add-row">
            <select class="select" id="opAgent" aria-label="발언 AI">
              ${AGENTS.map(a => `<option value="${a.id}">[${esc(a.name)}]</option>`).join('')}
            </select>
            <button class="btn small primary" type="submit">추가</button>
          </div>
          <textarea class="ta" id="opText" rows="3" placeholder="의견·검토 요약을 입력하세요"></textarea>
        </form>
      </div>`;
  }

  function renderMeeting() {
    renderAgendaList();
    renderDetail();
    $('#boardLine1').textContent = state.agendas[0] ? state.agendas[0].title : '안건 없음';
    $('#boardLine2').textContent = state.agendas[1] ? state.agendas[1].title : '';
  }

  $('#agendaList').addEventListener('click', e => {
    const li = e.target.closest('.agenda-item');
    if (!li) return;
    state.activeAgenda = li.dataset.id;
    touch();
    renderMeeting();
  });
  $('#agendaList').addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const li = e.target.closest('.agenda-item');
    if (!li) return;
    e.preventDefault();
    state.activeAgenda = li.dataset.id;
    touch();
    renderMeeting();
  });

  $('#agendaDetail').addEventListener('click', e => {
    const vbtn = e.target.closest('.v-btn');
    if (vbtn) {
      const ag = currentAgenda();
      const id = vbtn.dataset.agent;
      ag.votes[id] = (ag.votes[id] === vbtn.dataset.v) ? undefined : vbtn.dataset.v;
      if (!ag.votes[id]) delete ag.votes[id];
      touch();
      renderMeeting();
      return;
    }
    const del = e.target.closest('.del');
    if (del) {
      const ag = currentAgenda();
      ag.opinions = ag.opinions.filter(o => o.id !== del.dataset.op);
      touch();
      renderMeeting();
    }
  });

  $('#agendaDetail').addEventListener('submit', e => {
    if (!e.target.matches('#opForm')) return;
    e.preventDefault();
    const text = $('#opText').value.trim();
    if (!text) { toast('의견 내용을 입력하세요'); return; }
    const ag = currentAgenda();
    ag.opinions.push({ id: uid(), agent: $('#opAgent').value, ts: nowStamp(), text });
    $('#opText').value = '';
    touch();
    renderMeeting();
    toast('의견을 추가했습니다');
  });

  /* 새 안건 */
  $('#btnNewAgenda').addEventListener('click', () => {
    const title = prompt('새 안건 제목을 입력하세요');
    if (!title || !title.trim()) return;
    const desc = prompt('안건 설명 (선택 · 비워도 됩니다)') || '';
    const id = uid();
    state.agendas.push({
      id, title: title.trim(), desc: desc.trim(), tags: ['신규'],
      createdAt: nowStamp(), votes: {},
      opinions: []
    });
    state.activeAgenda = id;
    touch();
    renderMeeting();
    toast('새 안건을 등록했습니다');
  });

  /* ---------------- 8. 붙여넣기 파싱 ---------------- */
  const ALIASES = {
    roy: 'Roy', 로이: 'Roy', 피클: 'Roy', pickle: 'Roy',
    chatgpt: 'ChatGPT', gpt: 'ChatGPT', 지피티: 'ChatGPT', 챗지피티: 'ChatGPT',
    muse: 'Muse', 뮤즈: 'Muse', 뮤즈ai: 'Muse',
    gemini: 'Gemini', 제미나이: 'Gemini', 제미니: 'Gemini'
  };
  function normalizeAgent(label) {
    const raw = String(label).split('|')[0].split('·')[0].trim().toLowerCase().replace(/\s+/g, '');
    return ALIASES[raw] || ALIASES[raw.replace(/[^a-z가-힣]/g, '')] || null;
  }

  function parsePasted(text) {
    const src = String(text || '').replace(/\r\n?/g, '\n').trim();
    if (!src) return [];
    const re = /^[\s>*\-•]*\[\s*([^\]\n]{1,28})\s*\]\s*/gm;
    const marks = [];
    let m;
    while ((m = re.exec(src)) !== null) {
      const agent = normalizeAgent(m[1]);
      if (!agent) continue;
      marks.push({ agent, start: m.index, contentStart: m.index + m[0].length });
    }
    if (!marks.length) {
      return [{ agent: null, text: src }];
    }
    const out = [];
    marks.forEach((mk, i) => {
      const end = i + 1 < marks.length ? marks[i + 1].start : src.length;
      let body = src.slice(mk.contentStart, end).trim();
      body = body.replace(/^[*_`\s]+|[*_`\s]+$/g, '');
      if (!body) return;
      out.push({ agent: mk.agent, text: body });
    });
    return out;
  }

  let pendingParse = null;
  $('#btnParse').addEventListener('click', () => {
    const items = parsePasted($('#pasteBox').value);
    pendingParse = items;
    const box = $('#parsePreview');
    const usable = items.filter(i => i.agent);
    $('#btnApplyPaste').disabled = usable.length === 0;
    if (!items.length) {
      box.innerHTML = '<p class="tiny muted">붙여넣은 내용이 없습니다.</p>';
      return;
    }
    box.innerHTML = items.map(it => {
      const label = it.agent ? `[${it.agent}]` : '말머리 없음 · 한 덩어리로 추가';
      const color = it.agent ? (agentById(it.agent).color) : '#8b97ad';
      return `<div class="pv"><b style="color:${color}">${esc(label)}</b>${esc(it.text.slice(0, 180))}${it.text.length > 180 ? '…' : ''}</div>`;
    }).join('') + `<p class="tiny muted">${usable.length}건을 현재 안건에 추가할 수 있습니다.</p>`;
  });

  $('#btnApplyPaste').addEventListener('click', () => {
    const items = (pendingParse || parsePasted($('#pasteBox').value)).filter(i => i.agent);
    if (!items.length) return;
    const ag = currentAgenda();
    const ts = nowStamp();
    items.forEach(it => ag.opinions.push({ id: uid(), agent: it.agent, ts, text: it.text }));
    touch();
    $('#pasteBox').value = '';
    $('#parsePreview').innerHTML = '';
    $('#btnApplyPaste').disabled = true;
    pendingParse = null;
    renderMeeting();
    toast(`${items.length}건을 "${ag.title.slice(0, 14)}…"에 추가했습니다`);
  });

  /* ---------------- 9. 작업실 ---------------- */
  function renderWork() {
    $('#botSteps').querySelectorAll('li').forEach(li => {
      const i = Number(li.dataset.step);
      li.classList.toggle('done', i < state.botStep);
      li.classList.toggle('current', i === state.botStep);
    });
    $('#storageLine').textContent = db.enabled
      ? '저장 위치: Firebase 클라우드 + 이 브라우저'
      : '저장 위치: 이 브라우저 (localStorage)';
  }

  $('#botSteps').addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    state.botStep = Number(li.dataset.step);
    touch();
    renderWork();
  });

  $('#btnExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `ai-office-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('JSON으로 내보냈습니다');
  });

  $('#btnReset').addEventListener('click', () => {
    if (!confirm('안건·의견·투표를 모두 초기 샘플 상태로 되돌릴까요?')) return;
    state = seedState();
    state.updatedAt = Date.now();
    selectedAgent = state.activeAgent;
    localStorage.setItem(LS_KEY, JSON.stringify(state));
    applyAgentStatus();
    renderPanel();
    renderMeeting();
    renderWork();
    if (db.enabled) pushState();
    toast('초기 상태로 되돌렸습니다');
  });

  /* ---------------- 10. DB 연동 (Firebase RTDB REST) ---------------- */
  const db = {
    enabled: false,
    url: '',
    pushing: false,
    pushTimer: null,
    pollTimer: null,
    lastJson: ''
  };

  function normalizeDbUrl(raw) {
    let u = String(raw || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    u = u.replace(/\/+$/, '');
    return u;
  }

  async function dbFetch(url) {
    const res = await fetch(url + '/office.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function dbWrite(url, data) {
    const res = await fetch(url + '/office.json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json().catch(() => null);
  }

  function setSyncBadge(kind) {
    const badge = $('#syncBadge');
    const text = $('#syncText');
    badge.dataset.state = kind;
    if (kind === 'cloud') text.textContent = '클라우드 동기화';
    else if (kind === 'saving') text.textContent = '저장 중…';
    else if (kind === 'error') text.textContent = '동기화 오류';
    else text.textContent = '로컬 저장';
  }

  function schedulePush() {
    clearTimeout(db.pushTimer);
    db.pushTimer = setTimeout(pushState, 800);
  }

  async function pushState() {
    if (!db.enabled || db.pushing) return;
    db.pushing = true;
    try {
      state.updatedAt = Date.now();
      const json = JSON.stringify(state);
      localStorage.setItem(LS_KEY, json);
      db.lastJson = json;
      await dbWrite(db.url, state);
      setSyncBadge('cloud');
      dirty = false;
    } catch (err) {
      setSyncBadge('error');
      $('#dbStatus').textContent = '동기화 실패: ' + err.message + ' — URL·권한(규칙)을 확인하세요.';
      $('#dbStatus').dataset.state = 'error';
    } finally {
      db.pushing = false;
    }
  }

  async function pullState(initial) {
    if (!db.enabled) return;
    try {
      const remote = await dbFetch(db.url);
      if (remote && remote.agendas && Array.isArray(remote.agendas)) {
        const remoteTime = Number(remote.updatedAt || 0);
        if (remoteTime > Number(state.updatedAt || 0) + 300) {
          const keep = db.lastJson;
          state = Object.assign(seedState(), remote);
          state.agents = Object.assign(seedState().agents, remote.agents || {});
          db.lastJson = JSON.stringify(state);
          if (keep !== db.lastJson) {
            localStorage.setItem(LS_KEY, db.lastJson);
            selectedAgent = state.activeAgent || selectedAgent;
            applyAgentStatus();
            renderPanel();
            renderMeeting();
            renderWork();
            if (!initial) toast('클라우드에서 최신 데이터를 받았습니다');
          }
        } else if (initial) {
          // 원격이 비어 있거나 더 오래됨 → 이 브라우저 데이터를 올린다
          await pushState();
        }
      } else if (initial) {
        await pushState();
      }
      setSyncBadge('cloud');
    } catch (err) {
      setSyncBadge('error');
      $('#dbStatus').textContent = '연결 실패: ' + err.message;
      $('#dbStatus').dataset.state = 'error';
    }
  }

  function startPolling() {
    clearInterval(db.pollTimer);
    db.pollTimer = setInterval(() => {
      if (!db.enabled || document.hidden) return;
      pullState(false);
    }, 6000);
  }

  function enableDb(url, silent) {
    db.url = url;
    db.enabled = true;
    localStorage.setItem(DB_KEY, url);
    $('#dbUrlInput').value = url;
    $('#dbStatus').textContent = '연결됨 · ' + url;
    $('#dbStatus').dataset.state = 'ok';
    setSyncBadge('cloud');
    renderWork();
    pullState(true).then(startPolling);
    if (!silent) toast('클라우드 동기화를 켰습니다');
  }

  function disableDb(silent) {
    db.enabled = false;
    db.url = '';
    localStorage.removeItem(DB_KEY);
    clearInterval(db.pollTimer);
    $('#dbStatus').textContent = '연결되지 않음 · 로컬 저장 모드';
    $('#dbStatus').dataset.state = 'idle';
    setSyncBadge('local');
    renderWork();
    if (!silent) toast('DB 연동을 해제했습니다 (로컬 저장)');
  }

  /* 모달 */
  function openDbModal() {
    $('#dbModal').hidden = false;
    const saved = localStorage.getItem(DB_KEY) || '';
    $('#dbUrlInput').value = saved;
    $('#dbStatus').textContent = saved ? '연결됨 · ' + saved : '연결되지 않음 · 로컬 저장 모드';
    $('#dbStatus').dataset.state = saved ? 'ok' : 'idle';
    setTimeout(() => $('#dbUrlInput').focus(), 60);
  }
  function closeDbModal() { $('#dbModal').hidden = true; }

  $('#btnDb').addEventListener('click', openDbModal);
  $$('[data-close]').forEach(el => el.addEventListener('click', closeDbModal));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#dbModal').hidden) closeDbModal();
  });

  $('#btnDbSave').addEventListener('click', async () => {
    const url = normalizeDbUrl($('#dbUrlInput').value);
    if (!url) { toast('DB URL을 입력하세요'); return; }
    $('#dbStatus').textContent = '연결 확인 중…';
    $('#dbStatus').dataset.state = 'idle';
    try {
      await dbFetch(url);
      enableDb(url, true);
      toast('연결 완료 · 실시간 동기화 시작');
    } catch (err) {
      $('#dbStatus').textContent = '연결 실패: ' + err.message + ' — URL과 DB 규칙(읽기/쓰기 허용)을 확인하세요.';
      $('#dbStatus').dataset.state = 'error';
    }
  });

  $('#btnDbTest').addEventListener('click', async () => {
    const url = normalizeDbUrl($('#dbUrlInput').value) || db.url;
    if (!url) { toast('DB URL을 입력하세요'); return; }
    $('#dbStatus').textContent = '테스트 중…';
    try {
      const data = await dbFetch(url);
      $('#dbStatus').textContent = data
        ? '연결 정상 · 기존 데이터 ' + (data.agendas ? data.agendas.length + '개 안건' : '있음')
        : '연결 정상 · 빈 DB (처음 연결하면 이 브라우저 데이터를 올립니다)';
      $('#dbStatus').dataset.state = 'ok';
    } catch (err) {
      $('#dbStatus').textContent = '테스트 실패: ' + err.message;
      $('#dbStatus').dataset.state = 'error';
    }
  });

  $('#btnDbClear').addEventListener('click', () => {
    $('#dbUrlInput').value = '';
    disableDb(false);
  });

  /* ---------------- 11. 부팅 ---------------- */
  function boot() {
    initSprites();
    applyAgentStatus();
    selectAgent(selectedAgent);
    renderMeeting();
    renderWork();
    updateClock();
    setInterval(updateClock, 20000);
    startOfficeLoop();

    const hash = (location.hash || '').replace('#', '');
    if (['office', 'meeting', 'work'].includes(hash)) setTab(hash);

    const savedUrl = localStorage.getItem(DB_KEY);
    if (savedUrl) enableDb(normalizeDbUrl(savedUrl), true);
    else setSyncBadge('local');

    // 8초 뒤 첫 인사
    setTimeout(() => {
      const id = AGENT_IDS[Math.floor(Math.random() * AGENT_IDS.length)];
      speak(id);
    }, 1400);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
