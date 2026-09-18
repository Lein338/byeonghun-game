# 🥊 병훈이 개패기 (Byeonghun Puncher)

> iOS Safari & Android Chrome 크로스 플랫폼 최적화 플래시 스타일 아케이드 클리커 웹 게임

---

## 🎮 게임 설명
- **조작법:** 화면 중앙의 병훈이를 탭/클릭하여 타격합니다.
- **다중 터치(Multi-touch):** 두 손가락, 세 손가락으로 동시에 두드리면 초고속 연타가 가능합니다.
- **크리티컬(Critical Hit):** 3%의 확률로 강력한 펀치와 함께 **+10대**가 누적됩니다.
- **게임 목표:** 누적 1,000,000대 달성 시 **Game Clear** 엔딩 모달 노출!
- **저장:** 모든 타격 데이터는 브라우저 `localStorage`에 자동 저장됩니다.

---

## 🚀 Cloudflare Pages 배포 방법 (초간단 2분 컷)

### 1. GitHub 저장소에 푸시하기
터미널에서 본 프로젝트 폴더로 이동한 후:
```bash
cd /Users/jhshim/.gemini/antigravity/scratch/byeonghun-game
git init
git add .
git commit -m "feat: initial commit of 병훈이 개패기 game"
git branch -M main
git remote add origin <사용자님의_GitHub_저장소_URL>
git push -u origin main
```

### 2. Cloudflare Pages 연결
1. [Cloudflare 대시보드](https://dash.cloudflare.com/)에 로그인합니다.
2. 좌측 메뉴에서 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**을 클릭합니다.
3. 방금 푸시한 GitHub 저장소를 선택합니다.
4. 빌드 설정:
   - **Framework preset:** `None`
   - **Build command:** (비워둠)
   - **Build output directory:** `/` (루트)
5. **Save and Deploy** 버튼을 누르면 끝!
6. 약 10초 후 부여되는 `https://<프로젝트명>.pages.dev` 링크를 복사하여 지인들에게 공유합니다.

---

## 📱 모바일 홈 화면 추가 (앱처럼 즐기기)
- **iOS Safari:** 공유 버튼(네모+화살표) -> `홈 화면에 추가`
- **Android Chrome:** 상단 점 3개 메뉴 -> `홈 화면에 추가` 또는 `앱 설치`
- 주소창 없이 전체 화면(Fullscreen PWA)으로 더욱 쾌적하게 즐길 수 있습니다.
