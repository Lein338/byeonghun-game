/**
 * 병훈이 개패기 (Byeonghun Puncher) - Core Game Engine
 * Features:
 * 1. Stage System (1단계 100대, 2단계 500대 ... 8단계 1,000,000대)
 * 2. Realistic Fleshy Punch Sound (리얼 퍽퍽 사운드 & 피치 변조)
 * 3. Fever Time (0.05% 확률 발동, 10초간 10배 데미지)
 */

(function () {
  'use strict';

  // --- 스테이지 정의 ---
  const STAGES = [
    { stage: 1, name: "동네 골목길", goal: 100 },
    { stage: 2, name: "학교 복도", goal: 500 },
    { stage: 3, name: "노래방 앞", goal: 2000 },
    { stage: 4, name: "동아리방", goal: 10000 },
    { stage: 5, name: "강남역 사거리", goal: 50000 },
    { stage: 6, name: "지하 격투장", goal: 200000 },
    { stage: 7, name: "진격의 거인", goal: 500000 },
    { stage: 8, name: "우주 정복 (FINAL)", goal: 1000000 }
  ];

  const MAX_GOAL = 1000000;
  const CRIT_RATE = 0.03;       // 3% 크리티컬
  const FEVER_RATE = 0.0005;    // 0.05% 피버타임
  const FEVER_DURATION = 10000; // 10초

  // 스토리지 키
  const STORAGE_KEY_TOTAL_HITS = 'bh_total_hits';
  const STORAGE_KEY_STAGE_IDX  = 'bh_stage_idx';
  const STORAGE_KEY_CRITS      = 'bh_punch_crits';
  const STORAGE_KEY_CUSTOM_IMG = 'bh_punch_custom_img';
  const STORAGE_KEY_SOUND      = 'bh_punch_sound';
  const STORAGE_KEY_HAPTIC     = 'bh_punch_haptic';

  // --- 상태값 ---
  let totalHits = parseInt(localStorage.getItem(STORAGE_KEY_TOTAL_HITS) || localStorage.getItem('bh_punch_hits') || '0', 10);
  let currentStageIdx = parseInt(localStorage.getItem(STORAGE_KEY_STAGE_IDX) || '0', 10);
  let critCount = parseInt(localStorage.getItem(STORAGE_KEY_CRITS) || '0', 10);
  let soundEnabled = localStorage.getItem(STORAGE_KEY_SOUND) !== 'false';
  let hapticEnabled = localStorage.getItem(STORAGE_KEY_HAPTIC) !== 'false';
  let isCleared = totalHits >= MAX_GOAL;

  // 스테이지 인덱스 보정 (기존 세이브 데이터가 있을 경우 알맞은 스테이지로 자동 동기화)
  syncStageWithHits();

  function syncStageWithHits() {
    for (let i = 0; i < STAGES.length; i++) {
      if (totalHits < STAGES[i].goal) {
        currentStageIdx = i;
        return;
      }
    }
    currentStageIdx = STAGES.length - 1;
  }

  // 피버타임 상태
  let isFever = false;
  let feverEndTime = 0;
  let feverInterval = null;

  // CPS & 타격 애니메이션
  let recentHits = [];
  let currentCps = 0;
  let hitToggle = false;
  let dizzyTimeout = null;
  let spriteTimeout = null;
  let currentCustomImg = localStorage.getItem(STORAGE_KEY_CUSTOM_IMG) || null;

  // --- DOM 요소 캐싱 ---
  const stageBadgeEl = document.getElementById('stage-badge');
  const stageGoalTextEl = document.getElementById('stage-goal-text');
  const feverBannerEl = document.getElementById('fever-banner');
  const feverTimerEl = document.getElementById('fever-timer');
  const feverAuraEl = document.getElementById('fever-aura');
  const stageClearToastEl = document.getElementById('stage-clear-toast');
  const toastDescEl = document.getElementById('toast-desc');

  const hitCountEl = document.getElementById('hit-count');
  const totalHitCountEl = document.getElementById('total-hit-count');
  const progressBarEl = document.getElementById('progress-bar');
  const progressPercentEl = document.getElementById('progress-percent');
  const critStatsEl = document.getElementById('crit-stats');
  const cpsDisplayEl = document.getElementById('cps-display');

  const stageEl = document.getElementById('stage');
  const charWrapperEl = document.getElementById('character-wrapper');
  const charContainerEl = document.getElementById('character-container');
  const charImgEl = document.getElementById('character-img');
  const dizzyStarsEl = document.getElementById('dizzy-stars');
  const floatingContainerEl = document.getElementById('floating-text-container');
  const gameContainerEl = document.getElementById('game-container');

  const soundBtn = document.getElementById('sound-btn');
  const hapticBtn = document.getElementById('haptic-btn');
  const infoBtn = document.getElementById('info-btn');
  const devMenuBtn = document.getElementById('dev-menu-btn');
  const settingsModal = document.getElementById('settings-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const resetDataBtn = document.getElementById('reset-data-btn');
  const customImgInput = document.getElementById('custom-image-input');
  const resetImgBtn = document.getElementById('reset-img-btn');
  const triggerFeverBtn = document.getElementById('trigger-fever-btn');
  const nextStageBtn = document.getElementById('next-stage-btn');

  const clearModal = document.getElementById('clear-modal');
  const clearCritCountEl = document.getElementById('clear-crit-count');
  const shareBtn = document.getElementById('share-btn');
  const restartGameBtn = document.getElementById('restart-game-btn');

  const fxCanvas = document.getElementById('fx-canvas');
  const ctx = fxCanvas.getContext('2d');

  // ==========================================================================
  // Web Audio API 오디오 엔진 (추출된 실제 MP3 타격음 + 합성기 듀얼 탑재)
  // ==========================================================================
  let audioCtx = null;
  const punchBuffers = [];
  let critBuffer = null;
  let samplesLoading = false;

  function initAudio() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (audioCtx && !samplesLoading && punchBuffers.length === 0) {
      preloadPunchSamples();
    }
  }

  // 유튜브 쇼츠에서 추출한 실제 고음질 퍽! MP3 샘플 프리로딩
  async function preloadPunchSamples() {
    samplesLoading = true;
    const sampleUrls = [
      './assets/punch1.mp3',
      './assets/punch2.mp3',
      './assets/punch3.mp3',
      './assets/punch4.mp3'
    ];

    for (const url of sampleUrls) {
      try {
        const resp = await fetch(url);
        const arrayBuf = await resp.arrayBuffer();
        const decoded = await audioCtx.decodeAudioData(arrayBuf);
        punchBuffers.push(decoded);
      } catch (err) {
        console.warn('Sample load error:', url, err);
      }
    }

    try {
      const resp = await fetch('./assets/punch_crit.mp3');
      const arrayBuf = await resp.arrayBuffer();
      critBuffer = await audioCtx.decodeAudioData(arrayBuf);
    } catch (err) {}
  }

  /**
   * 실제 쇼츠 추출 펀치 MP3 재생 (지연시간 0초 AudioBufferSourceNode)
   */
  function playHitSound() {
    if (!soundEnabled || !audioCtx) return;

    // 추출된 실제 MP3 샘플이 준비된 경우: 실제 사운드 재생!
    if (punchBuffers.length > 0) {
      try {
        const source = audioCtx.createBufferSource();
        // 4개 중 랜덤으로 골라 타격음의 다채로움 극대화
        const buf = punchBuffers[Math.floor(Math.random() * punchBuffers.length)];
        source.buffer = buf;

        // 연타 시 피치 변조 (0.92 ~ 1.12배)로 살아있는 연타 타격감
        const pitchMod = 0.92 + Math.random() * 0.20;
        source.playbackRate.value = isFever ? (pitchMod * 1.15) : pitchMod;

        const gainNode = audioCtx.createGain();
        gainNode.gain.value = isFever ? 1.0 : 0.85;

        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        source.start(0);
        return;
      } catch (e) {
        console.warn('Sample play fallback', e);
      }
    }

    // Fallback: 물리 합성 신시사이저 타격음
    playSynthHitSound();
  }

  // Fallback용 물리 합성 사운드
  function playSynthHitSound() {
    try {
      const t = audioCtx.currentTime;
      const pitchMod = 0.92 + Math.random() * 0.22;
      const feverPitch = isFever ? 1.25 : 1.0;

      const thudOsc = audioCtx.createOscillator();
      const thudGain = audioCtx.createGain();

      thudOsc.type = 'triangle';
      thudOsc.frequency.setValueAtTime((175 * pitchMod) * feverPitch, t);
      thudOsc.frequency.exponentialRampToValueAtTime(38 * pitchMod, t + 0.08);

      thudGain.gain.setValueAtTime(0.85, t);
      thudGain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);

      thudOsc.connect(thudGain);
      thudGain.connect(audioCtx.destination);
      thudOsc.start(t);
      thudOsc.stop(t + 0.09);

      playFleshSnap(0.045, 0.45 * (isFever ? 1.3 : 1.0), 1300 * pitchMod);
    } catch (e) {}
  }

  // 크리티컬 펀치 사운드 (쇼츠 크리티컬 MP3 또는 서브우퍼 쾅!)
  function playCriticalSound() {
    if (!soundEnabled || !audioCtx) return;

    if (critBuffer) {
      try {
        const source = audioCtx.createBufferSource();
        source.buffer = critBuffer;
        source.playbackRate.value = 0.9 + Math.random() * 0.15;
        const gain = audioCtx.createGain();
        gain.gain.value = 1.0;
        source.connect(gain);
        gain.connect(audioCtx.destination);
        source.start(0);
      } catch (e) {}
    }

    // 강력한 서브 베이스 추가
    try {
      const t = audioCtx.currentTime;
      const subOsc = audioCtx.createOscillator();
      const subGain = audioCtx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(260, t);
      subOsc.frequency.exponentialRampToValueAtTime(22, t + 0.38);

      subGain.gain.setValueAtTime(1.0, t);
      subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.38);

      subOsc.connect(subGain);
      subGain.connect(audioCtx.destination);
      subOsc.start(t);
      subOsc.stop(t + 0.38);
    } catch (e) {}
  }

  // 피버타임 발동 사운드 (불꽃 폭발 '슈아아악! 쾅!')
  function playFeverStartSound() {
    if (!soundEnabled || !audioCtx) return;
    try {
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);

      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(t);
      osc.stop(t + 0.5);

      playFleshSnap(0.4, 0.8, 2400);
    } catch (e) {}
  }

  // 스테이지 클리어 사운드 (상승 아르페지오 딩동댕동!)
  function playStageClearSound() {
    if (!soundEnabled || !audioCtx) return;
    const notes = [392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.45, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      }, idx * 75);
    });
  }

  // 최종 엔딩 팡파르 사운드
  function playFanfareSound() {
    if (!soundEnabled || !audioCtx) return;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.45);
      }, idx * 100);
    });
  }

  // --- 진동 햅틱 엔진 ---
  function triggerHaptic(isCrit) {
    if (!hapticEnabled) return;

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        if (isCrit) {
          navigator.vibrate([80, 40, 100]);
        } else {
          navigator.vibrate(isFever ? 65 : 45);
        }
      } catch (err) {}
    }

    playHapticAudioPulse(isCrit);
  }

  function playHapticAudioPulse(isCrit) {
    if (!audioCtx) return;
    try {
      const t = audioCtx.currentTime;
      const subOsc = audioCtx.createOscillator();
      const subGain = audioCtx.createGain();

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(isCrit ? 45 : 32, t);

      const dur = isCrit ? 0.08 : 0.05;
      subGain.gain.setValueAtTime(1.0, t);
      subGain.gain.exponentialRampToValueAtTime(0.01, t + dur);

      subOsc.connect(subGain);
      subGain.connect(audioCtx.destination);

      subOsc.start(t);
      subOsc.stop(t + dur);
    } catch (e) {}
  }

  // ==========================================================================
  // UI & 스코어보드 업데이트
  // ==========================================================================
  function updateScoreboard() {
    const stage = STAGES[currentStageIdx] || STAGES[STAGES.length - 1];
    const prevGoal = currentStageIdx > 0 ? STAGES[currentStageIdx - 1].goal : 0;
    const stageGoal = stage.goal;

    // 스테이지 뱃지 및 목표
    stageBadgeEl.textContent = `STAGE ${stage.stage}: ${stage.name}`;
    stageGoalTextEl.textContent = `목표: ${stageGoal.toLocaleString()}대`;

    // 현재 스테이지 진행도 표시
    hitCountEl.textContent = `${totalHits.toLocaleString()} / ${stageGoal.toLocaleString()}`;
    totalHitCountEl.textContent = totalHits.toLocaleString();

    // 프로그레스 바 (현재 스테이지 구간 기준)
    const stageRange = stageGoal - prevGoal;
    const stageCurrent = Math.max(0, totalHits - prevGoal);
    const stagePercent = Math.min(100, (stageCurrent / stageRange) * 100);
    progressBarEl.style.width = stagePercent + '%';

    // 전체 총 퍼센트
    const totalPercent = ((totalHits / MAX_GOAL) * 100);
    progressPercentEl.textContent = `${totalPercent.toFixed(2)}% (전체)`;

    const critRatio = totalHits > 0 ? ((critCount / totalHits) * 100).toFixed(1) : '3.0';
    critStatsEl.textContent = `💥 크리티컬: ${critCount.toLocaleString()}회 (${critRatio}%)`;

    // 저장
    localStorage.setItem(STORAGE_KEY_TOTAL_HITS, totalHits.toString());
    localStorage.setItem(STORAGE_KEY_STAGE_IDX, currentStageIdx.toString());
    localStorage.setItem(STORAGE_KEY_CRITS, critCount.toString());
  }

  // ==========================================================================
  // 피버 타임 시스템 (0.05% 확률, 10초간 10배 데미지)
  // ==========================================================================
  function triggerFeverTime() {
    if (isFever) {
      // 이미 피버 중이면 시간만 10초 리필
      feverEndTime = performance.now() + FEVER_DURATION;
      return;
    }

    isFever = true;
    feverEndTime = performance.now() + FEVER_DURATION;

    playFeverStartSound();
    triggerHaptic(true);

    feverBannerEl.classList.remove('hidden');
    feverAuraEl.classList.remove('hidden');

    // 불꽃 축하 파티클 발사
    launchFeverSparks();

    clearInterval(feverInterval);
    feverInterval = setInterval(() => {
      const remaining = Math.max(0, feverEndTime - performance.now());
      feverTimerEl.textContent = (remaining / 1000).toFixed(1) + 's';

      if (remaining <= 0) {
        endFeverTime();
      }
    }, 100);
  }

  function endFeverTime() {
    isFever = false;
    clearInterval(feverInterval);
    feverBannerEl.classList.add('hidden');
    feverAuraEl.classList.add('hidden');
  }

  // ==========================================================================
  // 스테이지 클리어 연출
  // ==========================================================================
  function checkStageProgress() {
    const currentGoal = STAGES[currentStageIdx].goal;

    if (totalHits >= currentGoal) {
      // 최종 100만대 클리어 검사
      if (totalHits >= MAX_GOAL && !isCleared) {
        triggerGameClear();
        return;
      }

      // 다음 스테이지로 진출 가능한 경우
      if (currentStageIdx < STAGES.length - 1) {
        currentStageIdx++;
        triggerStageClear(currentStageIdx);
      }
    }
  }

  let toastTimeout = null;
  function triggerStageClear(nextIdx) {
    const nextStage = STAGES[nextIdx];
    playStageClearSound();
    launchConfetti();

    // 토스트 팝업 갱신
    toastDescEl.textContent = `축하합니다! STAGE ${nextStage.stage} [${nextStage.name}] 진입!`;
    stageClearToastEl.classList.remove('hidden');

    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      stageClearToastEl.classList.add('hidden');
    }, 2200);

    updateScoreboard();
  }

  // ==========================================================================
  // 플로팅 텍스트 이펙트
  // ==========================================================================
  function spawnFloatingText(x, y, isCrit, damage) {
    const textEl = document.createElement('div');
    textEl.className = 'floating-dmg' + (isCrit ? ' critical' : '') + (isFever ? ' fever' : '');

    let label = `+${damage}`;
    if (isCrit) {
      label = isFever ? `🔥 CRITICAL! +${damage}` : `💥 CRITICAL! +${damage}`;
    } else if (isFever) {
      label = `🔥 +${damage}`;
    }

    textEl.textContent = label;

    const containerRect = gameContainerEl.getBoundingClientRect();
    const relativeX = x - containerRect.left;
    const relativeY = y - containerRect.top;

    textEl.style.left = `${relativeX}px`;
    textEl.style.top = `${relativeY}px`;

    floatingContainerEl.appendChild(textEl);

    setTimeout(() => {
      if (textEl.parentNode) {
        textEl.parentNode.removeChild(textEl);
      }
    }, 850);
  }

  // ==========================================================================
  // 타격 파티클 효과 (Canvas)
  // ==========================================================================
  let particles = [];
  function resizeCanvas() {
    fxCanvas.width = gameContainerEl.clientWidth;
    fxCanvas.height = gameContainerEl.clientHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function spawnHitParticles(x, y, isCrit) {
    const containerRect = gameContainerEl.getBoundingClientRect();
    const px = x - containerRect.left;
    const py = y - containerRect.top;

    const count = isCrit ? (isFever ? 35 : 22) : (isFever ? 18 : 8);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (isCrit ? 6 : 3.5) * (0.5 + Math.random());
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: isCrit ? Math.random() * 6 + 3 : Math.random() * 4 + 2,
        color: isFever ? '#ea580c' : (isCrit ? (Math.random() > 0.5 ? '#facc15' : '#ef4444') : '#ffffff'),
        alpha: 1,
        life: 1,
        decay: 0.04 + Math.random() * 0.03
      });
    }
  }

  function launchFeverSparks() {
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: fxCanvas.width * Math.random(),
        y: fxCanvas.height * 0.7,
        vx: (Math.random() - 0.5) * 8,
        vy: -(Math.random() * 10 + 4),
        size: Math.random() * 7 + 3,
        color: Math.random() > 0.5 ? '#f97316' : '#ef4444',
        alpha: 1,
        life: 1,
        decay: 0.02 + Math.random() * 0.02
      });
    }
  }

  function updateParticles() {
    ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    requestAnimationFrame(updateParticles);
  }
  requestAnimationFrame(updateParticles);

  // ==========================================================================
  // 타격 핸들러 (핵심 메커니즘)
  // ==========================================================================
  function hit(x, y) {
    if (isCleared) return;
    initAudio();

    // 0.05% 확률 피버타임 판정
    if (!isFever && Math.random() < FEVER_RATE) {
      triggerFeverTime();
    }

    // 3% 확률 크리티컬 판정
    const isCrit = Math.random() < CRIT_RATE;
    const baseDamage = isCrit ? 10 : 1;
    // 피버타임 시 10배 증폭!
    const damage = isFever ? (baseDamage * 10) : baseDamage;

    totalHits += damage;
    if (isCrit) {
      critCount++;
    }

    // CPS 측정용 타임스탬프
    const now = performance.now();
    recentHits.push(now);

    // 시각 & 촉각 & 청각 효과
    spawnFloatingText(x, y, isCrit, damage);
    spawnHitParticles(x, y, isCrit);
    triggerHaptic(isCrit);

    // 스프라이트 교체 & 캐릭터 전용 애니메이션 (화면은 고정)
    clearTimeout(spriteTimeout);
    if (isCrit) {
      playCriticalSound();

      charImgEl.src = './assets/critical.png';
      spriteTimeout = setTimeout(() => {
        charImgEl.src = currentCustomImg || './assets/target.png';
      }, 350);

      charContainerEl.classList.remove('anim-crit', 'anim-hit-left', 'anim-hit-right');
      void charContainerEl.offsetWidth; // reflow
      charContainerEl.className = 'anim-crit';

      hitCountEl.classList.remove('bump', 'crit-bump', 'fever-bump');
      void hitCountEl.offsetWidth;
      hitCountEl.classList.add('crit-bump');

      dizzyStarsEl.classList.remove('hidden');
      clearTimeout(dizzyTimeout);
      dizzyTimeout = setTimeout(() => {
        dizzyStarsEl.classList.add('hidden');
      }, 700);

    } else {
      playHitSound();

      charImgEl.src = './assets/hit.png';
      spriteTimeout = setTimeout(() => {
        charImgEl.src = currentCustomImg || './assets/target.png';
      }, 120);

      hitToggle = !hitToggle;
      charContainerEl.classList.remove('anim-crit', 'anim-hit-left', 'anim-hit-right');
      void charContainerEl.offsetWidth; // reflow
      charContainerEl.className = hitToggle ? 'anim-hit-left' : 'anim-hit-right';

      hitCountEl.classList.remove('bump', 'crit-bump', 'fever-bump');
      void hitCountEl.offsetWidth;
      hitCountEl.classList.add(isFever ? 'fever-bump' : 'bump');
    }

    updateScoreboard();
    checkStageProgress();
  }

  // --- CPS 주기적 계산 ---
  setInterval(() => {
    const now = performance.now();
    recentHits = recentHits.filter(t => now - t < 1000);
    currentCps = recentHits.length;
    cpsDisplayEl.textContent = currentCps;
  }, 200);

  // --- 멀티 터치 및 마우스 이벤트 바인딩 ---
  let isTouching = false;

  stageEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isTouching = true;
    initAudio();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      hit(touch.clientX, touch.clientY);
    }
    setTimeout(() => { isTouching = false; }, 300);
  }, { passive: false });

  stageEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || isTouching) return;
    e.preventDefault();
    hit(e.clientX, e.clientY);
  }, { passive: false });

  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // ==========================================================================
  // 최종 게임 클리어 연출 (1,000,000대)
  // ==========================================================================
  function triggerGameClear() {
    isCleared = true;
    totalHits = MAX_GOAL;
    updateScoreboard();
    clearCritCountEl.textContent = critCount.toLocaleString();

    playFanfareSound();
    clearModal.classList.remove('hidden');

    launchConfetti();
  }

  function launchConfetti() {
    const colors = ['#facc15', '#ef4444', '#3b82f6', '#10b981', '#ec4899', '#f97316'];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: fxCanvas.width * Math.random(),
        y: fxCanvas.height * 0.4,
        vx: (Math.random() - 0.5) * 12,
        vy: (Math.random() - 1.2) * 12,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 1,
        decay: 0.01 + Math.random() * 0.015
      });
    }
  }

  // ==========================================================================
  // 모달 & 버튼 이벤트
  // ==========================================================================
  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    localStorage.setItem(STORAGE_KEY_SOUND, soundEnabled);
    soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    soundBtn.classList.toggle('muted', !soundEnabled);
    if (soundEnabled) initAudio();
  });

  hapticBtn.addEventListener('click', () => {
    hapticEnabled = !hapticEnabled;
    localStorage.setItem(STORAGE_KEY_HAPTIC, hapticEnabled);
    hapticBtn.textContent = hapticEnabled ? '📳' : '📴';
    hapticBtn.classList.toggle('muted', !hapticEnabled);
    if (hapticEnabled) triggerHaptic(false);
  });

  infoBtn.addEventListener('click', () => {
    alert("🥊 [병훈이 개패기 룰]\n\n• 스테이지별 목표(1단계 100대, 2단계 500대...)를 돌파하세요!\n• 3% 확률로 강력한 크리티컬(+10대)!\n• 0.05% 확률로 10초간 🔥피버타임(데미지 10배) 발동!\n• 여러 손가락으로 화면을 동시에 두드려 폭풍 연타 가능!");
  });

  devMenuBtn.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });

  closeModalBtn.addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  settingsModal.querySelector('.modal-backdrop').addEventListener('click', () => {
    settingsModal.classList.add('hidden');
  });

  // 치트 버튼 이벤트
  document.querySelectorAll('.cheat-btn[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const add = parseInt(btn.getAttribute('data-add'), 10);
      totalHits += add;
      if (totalHits >= MAX_GOAL) {
        totalHits = MAX_GOAL;
        triggerGameClear();
      } else {
        syncStageWithHits();
      }
      updateScoreboard();
    });
  });

  document.querySelectorAll('.cheat-btn[data-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      totalHits = parseInt(btn.getAttribute('data-set'), 10);
      if (totalHits >= MAX_GOAL) {
        totalHits = MAX_GOAL;
        triggerGameClear();
      } else {
        syncStageWithHits();
      }
      updateScoreboard();
    });
  });

  // 피버타임 테스트 치트 버튼
  if (triggerFeverBtn) {
    triggerFeverBtn.addEventListener('click', () => {
      triggerFeverTime();
      settingsModal.classList.add('hidden');
    });
  }

  // 다음 스테이지 강제 이동 치트 버튼
  if (nextStageBtn) {
    nextStageBtn.addEventListener('click', () => {
      if (currentStageIdx < STAGES.length - 1) {
        currentStageIdx++;
        totalHits = STAGES[currentStageIdx - 1].goal;
        triggerStageClear(currentStageIdx);
        updateScoreboard();
      } else {
        totalHits = MAX_GOAL;
        triggerGameClear();
      }
    });
  }

  // 데이터 리셋
  resetDataBtn.addEventListener('click', () => {
    if (confirm('정말로 모든 타격 및 스테이지 기록을 0으로 초기화하시겠습니까?')) {
      totalHits = 0;
      currentStageIdx = 0;
      critCount = 0;
      isCleared = false;
      endFeverTime();
      updateScoreboard();
      settingsModal.classList.add('hidden');
      alert('초기화되었습니다!');
    }
  });

  // 공유하기 버튼
  shareBtn.addEventListener('click', () => {
    const text = `🏆 내가 병훈이를 1,000,000대 패서 전 스테이지를 클리어했다! 너도 해볼래?`;
    if (navigator.share) {
      navigator.share({
        title: '병훈이 개패기 클리어!',
        text: text,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text} ${window.location.href}`);
      alert('클리어 링크가 클립보드에 복사되었습니다! 친구들에게 공유해보세요.');
    }
  });

  // 다시하기
  restartGameBtn.addEventListener('click', () => {
    totalHits = 0;
    currentStageIdx = 0;
    critCount = 0;
    isCleared = false;
    clearModal.classList.add('hidden');
    updateScoreboard();
  });

  // 커스텀 이미지 업로드
  customImgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        currentCustomImg = dataUrl;
        charImgEl.src = dataUrl;
        try {
          localStorage.setItem(STORAGE_KEY_CUSTOM_IMG, dataUrl);
        } catch (err) {
          console.warn('LocalStorage image quota exceeded', err);
        }
        alert('사진이 변경되었습니다!');
      };
      reader.readAsDataURL(file);
    }
  });

  // 기본 이미지 복원
  resetImgBtn.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY_CUSTOM_IMG);
    currentCustomImg = null;
    charImgEl.src = './assets/target.png';
    alert('기본 사진으로 복원되었습니다.');
  });

  if (currentCustomImg) {
    charImgEl.src = currentCustomImg;
  }

  // 초기 사운드/진동 버튼 상태 동기화
  if (!soundEnabled) {
    soundBtn.textContent = '🔇';
    soundBtn.classList.add('muted');
  }
  if (!hapticEnabled) {
    hapticBtn.textContent = '📴';
    hapticBtn.classList.add('muted');
  }

  // 초기 스코어보드 렌더링
  updateScoreboard();

  // 첫 사용자 클릭 시 오디오 언락
  window.addEventListener('click', initAudio, { once: true });
  window.addEventListener('touchstart', initAudio, { once: true });

})();
