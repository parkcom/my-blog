# 픽셀 아트 에디터 — 구현 계획 (spec.md)

16×16 격자에 클릭·드래그(마우스/터치)로 도트를 찍고, 색상 팔레트로 색을 고르고,
완성한 그림을 PNG로 내려받는 미니 웹앱. 프레임워크·번들러 없이 순수 HTML/CSS/ES모듈로
`/apps/pixel-art/` 안에서 자체 완결한다. 블로그의 크림/잉크 톤과 같은 `"theme"` 키를 공유한다.

## 1. 파일 구조

`/apps/pixel-art/` 안에 3개 파일만 둔다. (`_*-task.md`, `spec.md`, `review.md`는 제외.)

- **`index.html`** — 시맨틱 마크업(툴바·캔버스 영역·팔레트), FOUC 방지 인라인 스크립트, `style.css`/`editor.js` 연결.
- **`style.css`** — 라이트/다크 테마 변수(`:root` / `[data-theme="dark"]`), 레이아웃·반응형, 격자/팔레트/버튼. 색은 변수로. **단, 픽셀 아트 색·팔레트 스워치 색은 테마 변수가 아닌 고정값**(§7).
- **`editor.js`** — ES 모듈. 픽셀 모델, DOM 격자 렌더, 포인터 입력, 팔레트/도구 상태, PNG 내보내기, 테마 토글 자체 포함(외부 모듈 미임포트).

## 2. 격자/그리기 모델

### 데이터 모델 (단일 진실원)
- **`pixels`: 길이 256 배열**, 각 원소는 `hex 색 문자열` 또는 `null`(빈 칸/투명).
- `GRID = 16`, `i = row*16 + col`. 렌더·내보내기·undo 모두 이 배열만 본다.

### 렌더 방식: DOM 격자(`div` 16×16) 채택
- 이유: 256셀은 DOM으로 충분히 가볍고, 칠하기가 `cell.style.backgroundColor = color` 한 줄로 단순. CSS 변수로 빈 칸/격자선 테마링 자유. 2048 보드와 같은 패턴이라 컨벤션 일치. 접근성 처리 자연스러움.
- 화면 격자(DOM)와 PNG 내보내기는 **독립**(내보내기는 별도 offscreen canvas에 모델을 다시 그림, §6).

### DOM 구성
- `#grid` + 그 안에 `<div class="cell" data-i="0..255">` 256개를 `editor.js`가 생성.
- CSS `display:grid; grid-template-columns: repeat(16,1fr); aspect-ratio:1/1`.
- 빈 칸은 **체커보드 패턴**(두 톤 교차, 테마 변수)으로 "투명" 표시. 칠한 칸은 `backgroundColor`로 덮어씀.

### 칠하기/지우기
- `paint(i, color)`: `color===null`이면 모델 `null` + 인라인 배경 제거(체커보드 복원), 색이면 모델·배경 동시 갱신.
- 펜 = 선택색 paint, 지우개 = `null` paint.

## 3. 입력 처리 — Pointer Events 단일 경로

마우스·터치·스타일러스를 **하나의 Pointer Events 경로**로 처리(셀별 mouseenter는 터치 드래그에 안 맞아 미사용).

### 좌표 → 셀 인덱스 (rect 수학)
```js
const r = grid.getBoundingClientRect();
const cellPx = r.width / GRID;
let col = clamp(Math.floor((e.clientX - r.left) / cellPx), 0, GRID - 1);
let row = clamp(Math.floor((e.clientY - r.top)  / cellPx), 0, GRID - 1);
const i = row * GRID + col;
```
- `clamp`로 격자 밖→안 복귀가 자연스러움. 단 명백히 영역 밖이면 paint 건너뜀.

### 드래그 페인트
- `#grid` `pointerdown`: `drawing=true`, 해당 셀 paint, `grid.setPointerCapture(e.pointerId)`.
- `pointermove`: `drawing`일 때만 좌표→셀 paint, `lastI` 가드로 중복 생략.
- `pointerup`/`pointercancel`: `drawing=false`, (undo 채택 시) 스트로크 끝에 스냅샷 1개 커밋.

### 스크롤/확대 방지 (모바일)
- `#grid` CSS `touch-action:none`. `pointermove`에서 `drawing`일 때 `preventDefault()`(리스너 `{passive:false}`). 컨테이너 `user-select:none`.

## 4. 색상 팔레트 UI

### 기본 14색 (테마 무관 고정 hex)
`#000000 #ffffff #7f7f7f #e43b44 #f77622 #feae34 #63c74d #3e8948 #0099db #124e89 #b55088 #ffadce #a05b53 #c0cbdc`

### 마크업/상태
- 각 색은 `<button class="swatch" style="--swatch:#xxxxxx">`, 배경 `var(--swatch)`.
- 선택색은 `aria-pressed="true"` + 강조 테두리/체크. 상태는 `selectedColor` 하나로 관리, 클릭 시 펜으로 자동 전환.
- **커스텀 색(포함)**: `<input type="color">` change 시 `selectedColor` 설정 + 펜 전환.

## 5. 도구

- **펜**(기본), **지우개**(`null` paint), **전체 지우기(Clear)**(모델 전체 `null` + 배경 제거, `confirm()` 1회 또는 undo로 보호).
- 상태: `tool = "pen"|"eraser"`, 툴바 버튼 `aria-pressed`로 활성 표시.

### 범위 / 비범위
- **필수**: 펜, 지우개, Clear, 팔레트 선택, PNG 저장.
- **권장 포함**: 커스텀 색 `<input type="color">`, **되돌리기(undo)** — 스트로크 단위 스냅샷 스택(최대 ~30).
- **비범위**: 채우기(flood fill), redo, 격자 크기 변경, 스포이드, localStorage 저장/불러오기, 프레임/애니메이션.

## 6. PNG 내보내기

화면 격자와 **별개 offscreen `<canvas>`**에 `fillRect`로 그려 안티에일리어싱을 배제.

```js
const SCALE = 20;                       // 셀당 20px → 320×320
const canvas = document.createElement("canvas");
canvas.width = canvas.height = GRID * SCALE;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
for (let i = 0; i < pixels.length; i++) {
  const c = pixels[i]; if (!c) continue;   // 빈 칸은 건너뛰어 투명 유지
  const col = i % GRID, row = (i / GRID) | 0;
  ctx.fillStyle = c;
  ctx.fillRect(col * SCALE, row * SCALE, SCALE, SCALE);
}
canvas.toBlob((blob) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "pixel-art.png"; a.click();
  URL.revokeObjectURL(url);
}, "image/png");
```
- 빈 칸 미렌더 → PNG 알파 투명, 격자선/UI 미포함(순수 픽셀만).
- 배율 셀당 16~32px 권장(기본 20 → 320×320).
- **주의**: `putImageData`는 스케일을 무시하므로 확대 export에 쓰지 말 것 → `fillRect` per cell 사용.

## 7. 레이아웃 / 반응형 / 테마

### 배치
- 세로 스택: **상단 툴바**(펜·지우개·Clear·Undo·PNG 저장·테마 토글) → **중앙 격자**(정사각, `width:min(92vw,480px); aspect-ratio:1/1`) → **하단 팔레트**(스워치 그리드 + 커스텀 색) → `← 블로그로`(`../../index.html`) 푸터.

### 테마 (블로그 크림/잉크 톤 공유)
- 라이트 `--bg:#f4efe4; --bg-raised:#faf6ec; --text:#211c17; --accent:#b5432a; --rule:#ddd3bf` / 다크 `--bg:#16120e; --bg-raised:#1d1813; --text:#ece3d4; --accent:#e07043; --rule:#2e271f`. **UI(배경·툴바·테두리·체커보드 빈 칸)에만** 적용.
- **작품에는 테마 적용 금지**: 팔레트 스워치·칠한 픽셀은 고정 hex(절대 `var(--accent)` 등에 연결 금지 — 전환 시 그림이 바뀜).
- `<head>`에 블로그/2048과 동일한 FOUC 방지 인라인 스크립트(같은 `"theme"` 키). 토글 버튼 포함(클릭 시 `data-theme` 전환 + `localStorage` 기록), 해/달 SVG 재사용하되 로직은 `editor.js` 자체 포함.

## 8. 접근성

- 모든 도구·스워치·저장·토글은 실제 `<button>`/`<input>`/`<a>`. `<main>` 사용.
- 팔레트 스워치 Tab/Enter/Space 선택 가능, `aria-pressed`로 상태 노출.
- `#grid`는 256개를 탭 스톱으로 만들지 않고 `role="img"`/`aria-label` 1개 + `.hint` 조작 안내. 격자 방향키 드로잉은 **비범위**(명시적 고정).
- 선택 강조는 색만이 아니라 테두리/체크 등 비색상 단서 병행. 충분한 대비.

## 9. 검증 방법

### 로컬 서버
- `python3 -m http.server 8000` → `http://localhost:8000/apps/pixel-art/`.

### 테스트 시나리오
- 그리기(클릭 한 칸), 드래그(연속 + 격자 밖→안 클램프), 지우개(체커보드 복원), Clear(전체 비움), Undo(스트로크 단위).
- 팔레트 전환(강조 + 반영), 커스텀 색 반영.
- **PNG 저장**: 격자선·UI 없이 순수 픽셀, 빈 칸 투명, 안티에일리어싱 없이 선명(320×320), 색 일치.
- 모바일 터치 스와이프 드로잉 + 스크롤/핀치/새로고침 차단.
- 반응형(좁은 화면 정사각 맞춤, 툴바/팔레트 안 깨짐).
- 라이트/다크: UI만 톤 변경, **그림·팔레트 색 불변**, 새로고침 `"theme"` 유지·FOUC 없음, 블로그 메인 iframe 미리보기도 같은 테마.

## 범위 / 비범위 요약
- **범위**: `/apps/pixel-art/` 내부 3파일만 생성. 블로그 다른 파일 미수정.
- **Embed 단계(별도)**: 승인·구현·검증 후 메인 `index.html`에 픽셀 아트 카드 추가 + 깃 커밋.
