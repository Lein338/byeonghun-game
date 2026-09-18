/**
 * 병훈이 개패기 (Byeonghun Puncher) - Core Game Engine
 */

(function () {
  'use strict';

  // --- 상수 & 환경 변수 ---
  const MAX_GOAL = 1000000;
  const CRIT_RATE = 0.03; // 3%
  const STORAGE_KEY_HITS = 'bh_punch_hits';
  const STORAGE_KEY_CRITS = 'bh_punch_crits';
  const STORAGE_KEY_CUSTOM_IMG = 'bh_punch_custom_img';
  const STORAGE_KEY_SOUND = 'bh_punch_sound';
  const STORAGE_KEY_HAPTIC = 'bh_punch_haptic';

  // --- 상태값 ---
  let hitCount = parseInt(localStorage.getItem(STORAGE_KEY_HITS) || '0', 10);
  let critCount = parseInt(localStorage.getItem(STORAGE_KEY_CRITS) || '0', 10);
  let soundEnabled = localStorage.getItem(STORAGE_KEY_SOUND) !== 'false';
  let hapticEnabled = localStorage.getItem(STORAGE_KEY_HAPTIC) !== 'false';
  let isCleared = hitCount >= MAX_GOAL;

  // CPS (Clicks Per Second) 측정 변수
  let recentHits = [];
  let currentCps = 0;

  // 애니메이션 토글 변수 (좌/우 번갈아 찌그러짐)
  let hitToggle = false;

  // --- DOM 요소 캐싱 ---
  const hitCountEl = document.getElementById('hit-count');
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

  const clearModal = document.getElementById('clear-modal');
  const clearCritCountEl = document.getElementById('clear-crit-count');
  const shareBtn = document.getElementById('share-btn');
  const restartGameBtn = document.getElementById('restart-game-btn');

  const fxCanvas = document.getElementById('fx-canvas');
  const ctx = fxCanvas.getContext('2d');

  // --- Web Audio API 합성 엔진 (외부 오디오 파일 없이 무지연 사운드 생성) ---
  let audioCtx = null;

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
  }

  // 일반 타격 사운드 (묵직한 퍽! 소리)
  function playHitSound() {
    if (!soundEnabled || !audioCtx) return;
    try {
      const t = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);

      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(t);
      osc.stop(t + 0.12);

      // 찰싹 소리를 위한 노이즈 버퍼 합성
      playNoiseSnap(0.04, 0.4);
    } catch (e) {
      console.warn('Audio play error', e);
    }
  }

  // 크리티컬 사운드 (강력한 쾅! 폭발음)
  function playCriticalSound() {
    if (!soundEnabled || !audioCtx) return;
    try {
      const t = audioCtx.currentTime;

      // 1. 깊은 서브 베이스 붐
      const subOsc = audioCtx.createOscillator();
      const subGain = audioCtx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(220, t);
      subOsc.frequency.exponentialRampToValueAtTime(25, t + 0.35);

      subGain.gain.setValueAtTime(1.0, t);
      subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);

      subOsc.connect(subGain);
      subGain.connect(audioCtx.destination);

      subOsc.start(t);
      subOsc.stop(t + 0.35);

      // 2. 강렬한 크런치 노이즈
      playNoiseSnap(0.18, 0.8);
    } catch (e) {
      console.warn('Crit audio error', e);
    }
  }

  // 노이즈 버퍼 제너레이터 (스냅/타격감 강화)
  function playNoiseSnap(duration, volume) {
    if (!audioCtx) return;
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;

    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime;
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    noise.start(t);
  }

  // 클리어 팡파르 사운드
  function playFanfareSound() {
    if (!soundEnabled || !audioCtx) return;
    const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        if (!audioCtx) return;
        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      }, idx * 100);
    });
  }

  // --- 진동 햅틱 (Android 지원 브라우저) ---
  function triggerHaptic(isCrit) {
    if (!hapticEnabled || !navigator.vibrate) return;
    try {
      if (isCrit) {
        navigator.vibrate([40, 20, 80]); // 크리티컬: 쿵쾅 2단 진동
      } else {
        navigator.vibrate(15); // 일반: 15ms 찰나의 진동
      }
    } catch (e) {
      // ignore
    }
  }

  // --- UI 업데이트 ---
  function updateScoreboard() {
    hitCountEl.textContent = hitCount.toLocaleString();
    const percent = ((hitCount / MAX_GOAL) * 100);
    progressBarEl.style.width = Math.min(100, percent) + '%';
    progressPercentEl.textContent = percent.toFixed(4) + '%';

    const critRatio = hitCount > 0 ? ((critCount / hitCount) * 100).toFixed(1) : '3.0';
    critStatsEl.textContent = `💥 크리티컬: ${critCount.toLocaleString()}회 (${critRatio}%)`;

    // 로컬 스토리지 저장 (주기적 동기화)
    localStorage.setItem(STORAGE_KEY_HITS, hitCount.toString());
    localStorage.setItem(STORAGE_KEY_CRITS, critCount.toString());
  }

  // --- 플로팅 텍스트 이펙트 ---
  function spawnFloatingText(x, y, isCrit) {
    const textEl = document.createElement('div');
    textEl.className = 'floating-dmg' + (isCrit ? ' critical' : '');
    textEl.textContent = isCrit ? '💥 CRITICAL! +10' : '+1';

    // 좌표 지정 (뷰포트 밖 탈출 방지)
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

  // --- 타격 파티클 효과 (Canvas) ---
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

    const count = isCrit ? 22 : 8;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (isCrit ? 5 : 3) * (0.5 + Math.random());
      particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: isCrit ? Math.random() * 6 + 3 : Math.random() * 4 + 2,
        color: isCrit ? (Math.random() > 0.5 ? '#facc15' : '#ef4444') : '#ffffff',
        alpha: 1,
        life: 1,
        decay: 0.04 + Math.random() * 0.03
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

  // --- 타격 핸들러 (핵심 메커니즘) ---
  let dizzyTimeout = null;
  let spriteTimeout = null;
  let currentCustomImg = localStorage.getItem(STORAGE_KEY_CUSTOM_IMG) || null;

  function hit(x, y) {
    if (isCleared) return;
    initAudio();

    // 3% 확률 크리티컬 판정
    const isCrit = Math.random() < CRIT_RATE;
    const damage = isCrit ? 10 : 1;

    hitCount += damage;
    if (isCrit) {
      critCount++;
    }

    // CPS 측정용 타임스탬프 기록
    const now = performance.now();
    recentHits.push(now);

    // 시각 & 촉각 & 청각 효과
    spawnFloatingText(x, y, isCrit);
    spawnHitParticles(x, y, isCrit);
    triggerHaptic(isCrit);

    // 스프라이트 이미지 전환
    clearTimeout(spriteTimeout);
    if (isCrit) {
      playCriticalSound();

      // 크리티컬 스프라이트
      charImgEl.src = './assets/critical.png';
      spriteTimeout = setTimeout(() => {
        charImgEl.src = currentCustomImg || './assets/target.png';
      }, 350);

      // 크리티컬 화면 흔들림 및 붉은 섬광
      gameContainerEl.classList.remove('screen-shake');
      void gameContainerEl.offsetWidth; // reflow
      gameContainerEl.classList.add('screen-shake');

      // 캐릭터 크리티컬 피격 모션
      charContainerEl.className = 'anim-crit';

      // 스코어 범프
      hitCountEl.classList.remove('bump', 'crit-bump');
      void hitCountEl.offsetWidth;
      hitCountEl.classList.add('crit-bump');

      // 머리 위 별 표시
      dizzyStarsEl.classList.remove('hidden');
      clearTimeout(dizzyTimeout);
      dizzyTimeout = setTimeout(() => {
        dizzyStarsEl.classList.add('hidden');
      }, 700);

    } else {
      playHitSound();

      // 일반 피격 스프라이트
      charImgEl.src = './assets/hit.png';
      spriteTimeout = setTimeout(() => {
        charImgEl.src = currentCustomImg || './assets/target.png';
      }, 120);

      // 좌/우 번갈아가며 타격 모션
      hitToggle = !hitToggle;
      charContainerEl.className = hitToggle ? 'anim-hit-left' : 'anim-hit-right';

      // 스코어 범프
      hitCountEl.classList.remove('bump', 'crit-bump');
      void hitCountEl.offsetWidth;
      hitCountEl.classList.add('bump');
    }

    updateScoreboard();

    // 1,000,000대 달성 검사
    if (hitCount >= MAX_GOAL && !isCleared) {
      triggerGameClear();
    }
  }

  // --- CPS 주기적 계산 ---
  setInterval(() => {
    const now = performance.now();
    recentHits = recentHits.filter(t => now - t < 1000);
    currentCps = recentHits.length;
    cpsDisplayEl.textContent = currentCps;
  }, 200);

  // --- 멀티 터치 및 마우스 이벤트 바인딩 ---
  stageEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    hit(e.clientX, e.clientY);
  }, { passive: false });

  // 모바일 다중 터치 (동시 2~3손가락 연타) 지원
  stageEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    initAudio();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      hit(touch.clientX, touch.clientY);
    }
  }, { passive: false });

  // 우클릭 메뉴 및 롱프레스 팝업 방어
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- 게임 클리어 연출 ---
  function triggerGameClear() {
    isCleared = true;
    hitCount = MAX_GOAL;
    updateScoreboard();
    clearCritCountEl.textContent = critCount.toLocaleString();

    playFanfareSound();
    clearModal.classList.remove('hidden');

    // 축하 폭죽 연속 발사
    launchConfetti();
  }

  function launchConfetti() {
    const colors = ['#facc15', '#ef4444', '#3b82f6', '#10b981', '#ec4899'];
    for (let i = 0; i < 80; i++) {
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

  // --- 모달 & 버튼 이벤트 ---
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
    alert("🥊 [병훈이 개패기 게임 룰]\n\n• 남성을 탭하여 1,000,000대를 때리세요!\n• 3% 확률로 강력한 크리티컬(+10)이 터집니다.\n• 여러 손가락으로 화면을 동시에 두드려 폭풍 연타가 가능합니다.\n• 데이터는 브라우저에 자동 저장됩니다.");
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
  document.querySelectorAll('.cheat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const add = btn.getAttribute('data-add');
      const setVal = btn.getAttribute('data-set');
      if (add) {
        hitCount += parseInt(add, 10);
      } else if (setVal) {
        hitCount = parseInt(setVal, 10);
      }
      if (hitCount >= MAX_GOAL) {
        hitCount = MAX_GOAL;
        triggerGameClear();
      }
      updateScoreboard();
    });
  });

  // 데이터 리셋
  resetDataBtn.addEventListener('click', () => {
    if (confirm('정말로 모든 타격 기록을 0으로 초기화하시겠습니까?')) {
      hitCount = 0;
      critCount = 0;
      isCleared = false;
      updateScoreboard();
      settingsModal.classList.add('hidden');
      alert('초기화되었습니다!');
    }
  });

  // 공유하기 버튼
  shareBtn.addEventListener('click', () => {
    const text = `🏆 내가 병훈이를 1,000,000대 패서 게임을 클리어했다! 너도 해볼래?`;
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
    hitCount = 0;
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

  // 커스텀 이미지 저장분 복원
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
