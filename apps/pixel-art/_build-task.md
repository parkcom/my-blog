# Build 서브에이전트 지침 — 픽셀 아트 에디터

## 역할
너는 **Build 단계** 서브에이전트다. 승인된 계획대로 픽셀 아트 에디터를 **구현**한다.

## 먼저 읽을 것
- `/Users/parkcom/study/my-blog/apps/pixel-art/spec.md` — 승인된 구현 계획. 그대로 따른다.
- (참고용, 수정 금지) `/Users/parkcom/study/my-blog/apps/2048/index.html`, `apps/2048/style.css` — FOUC 인라인 스크립트·크림/잉크 테마 변수·`touch-action:none`·백링크 패턴 차용용.

## 수정 허용 범위 (엄격)
다음 3개 파일만 **생성**한다:
- `/Users/parkcom/study/my-blog/apps/pixel-art/index.html`
- `/Users/parkcom/study/my-blog/apps/pixel-art/style.css`
- `/Users/parkcom/study/my-blog/apps/pixel-art/editor.js`

**그 외 어떤 파일도 건드리지 마라.** 특히 블로그 루트의 `index.html`, `css/`, `js/`, `posts/`, `CLAUDE.md`, `spec.md`, 다른 앱 폴더는 수정 금지. (메인 카드 추가/깃 커밋은 이후 Embed 단계에서 부모가 한다.)

## 구현 요구사항 (spec.md 핵심 재확인)
- 순수 HTML/CSS/JS(ES 모듈). 외부 라이브러리·CDN 0. 프레임워크·번들러 금지.
- **16×16 DOM 격자**(div 256개), 빈 칸 체커보드. 모델은 길이 256 배열(`hex` 또는 `null`), `GRID=16`, `i=row*16+col`.
- **Pointer Events 단일 경로**: `pointerdown`에서 `setPointerCapture`, rect 수학으로 좌표→셀(clamp), 드래그 페인트, `lastI` 중복 가드. `#grid{touch-action:none}` + `drawing` 중 `pointermove`에서 `preventDefault()`(리스너 `{passive:false}`).
- **팔레트**: 고정 14색 스워치(`<button>`, 배경 `var(--swatch)` 고정 hex) + 현재색 `aria-pressed` 강조 + 커스텀 색 `<input type="color">`.
- **도구**: 펜(기본), 지우개(`null` paint), 전체 지우기(Clear, confirm 또는 undo로 보호), **되돌리기(undo, 스트로크 단위 스냅샷 스택 최대 ~30)**.
- **PNG 저장**: 별도 offscreen `<canvas>`(GRID*SCALE, SCALE=20 → 320×320), `imageSmoothingEnabled=false`, 빈 칸은 건너뛰어 투명, `fillRect` per cell, `toBlob`→`<a download="pixel-art.png">`. `putImageData` 확대 함정 회피.
- **반응형**: 격자 `width:min(92vw,480px); aspect-ratio:1/1`. 좁은 화면에서 툴바/팔레트 안 깨짐.
- **테마**: `:root`/`[data-theme="dark"]` 크림/잉크 팔레트(UI 크롬에만). **팔레트·픽셀 색은 고정 hex(테마 변수 연결 금지)**. `<head>`에 FOUC 방지 인라인 스크립트(같은 `"theme"` 키 읽기). 테마 토글 버튼 포함(클릭 시 `data-theme` 전환 + `localStorage.setItem("theme",...)`), 로직은 `editor.js` 자체 포함(외부 모듈 임포트 금지). 푸터 `← 블로그로`(`../../index.html`).
- **접근성**: 시맨틱 마크업, 실제 버튼, 팔레트 키보드 접근 + `aria-pressed`, `#grid`는 `role="img"`+`aria-label` 1개(256 탭스톱 금지), `.hint` 조작 안내, 비색상 선택 단서.

## 코드 컨벤션
- 들여쓰기 스페이스 2칸. ES 모듈. 전역 오염 회피. 주석은 "왜"만 간결히.

## 마치며
구현을 끝내면 만든 파일과 주요 설계 결정(특히 Pointer Events 드래그·PNG fillRect 내보내기·테마와 작품 색 분리·undo)을 요약해 보고하라. **로컬 서버 실행이나 브라우저 검증은 하지 마라 — Review 단계의 일이다.** 단, 명백한 문법 오류가 없는지는 스스로 확인하라.
