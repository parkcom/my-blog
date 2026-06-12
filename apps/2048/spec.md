# 2048 게임 웹앱 — 구현 계획 (spec.md)

순수 HTML/CSS/JS(ES 모듈)로 `/apps/2048/` 안에 자체 완결되는 2048 퍼즐 게임.
키보드 방향키 + 모바일 터치 스와이프 지원. 블로그의 편집형(문예지) 톤과 어울리되 독립 구현.

---

## 1. 파일 구조

`/apps/2048/` 안에 둘 파일 (spec.md / review.md / `_*-task.md` 지침 파일은 제외):

| 파일 | 역할 |
|------|------|
| `index.html` | 마크업 진입점. 헤더(제목·점수판), 보드 컨테이너, 새 게임 버튼, 오버레이(승리/게임오버). `<head>`에 FOUC 방지용 인라인 테마 스크립트, `<script type="module" src="game.js">` 로드. |
| `style.css` | 전체 스타일. CSS 변수로 라이트/다크 팔레트 + 타일 숫자별 색, 반응형 보드, 애니메이션 정의. |
| `game.js` | 게임 로직 + 렌더링 + 입력 처리 전부. ES 모듈, 외부 의존 0. |

- 외부 라이브러리·CDN 없음(폰트는 system-ui 스택). 블로그의 `css/style.css`, `js/*`에 의존하지 않음.

---

## 2. 게임 로직 설계 (`game.js`)

### 보드 표현
- `board`: 4×4 2차원 배열(빈 칸 `0`). 상태: `board`, `score`, `best`(localStorage), `won`, `over`.
- 상수: `SIZE=4`, `WIN_VALUE=2048`, `STORAGE_KEY_BEST="2048-best"`.

### 이동/병합 — 한 방향(왼쪽)으로 일반화
모든 이동을 "왼쪽으로 밀기"로 환원. 다른 방향은 보드를 변형해 왼쪽 연산 적용 후 되돌림.

`slideRowLeft(row)`:
1. 0 제거(`filter`)로 타일을 왼쪽으로 모음.
2. 왼쪽부터 인접한 두 값이 같으면 병합(2배), 점수 누적, 인덱스 2칸 전진. 다르면 1칸 전진.
3. 결과를 4칸으로 만들되 오른쪽 `0` 패딩.
4. 반환: `{ row, gained, merged }`.

**더블 병합 잠금(필수):** 한 이동에서 어떤 타일도 두 번 병합되지 않음.
- `[2,2,2,2] → [4,4,0,0]` (8 아님)
- `[4,4,2,2] → [8,4,0,0]`
- `[2,2,2,0] → [4,2,0,0]`
- `[2,0,2,2] → [4,2,0,0]`

### 방향 일반화
- 헬퍼: `transpose(board)`, `reverseRows(board)`.
- left: 그대로 / right: reverse→slide→reverse / up: transpose→slide→transpose / down: transpose→reverse→slide→reverse→transpose.

### no-op 게이트
- 이동 전후 보드 비교. **변화가 있을 때만** 보드 갱신·점수 반영·새 타일 생성·렌더. 막힌 방향키는 무시.

### 새 타일 생성
- 빈 칸 중 무작위 1칸에 **90% `2`, 10% `4`**. 시작 시 2개 배치.

### 승리/패배
- 승리: 2048 타일 등장 + `won===false` → 승리 오버레이(계속하기 가능, `won` 유지).
- 패배(`canMove()`): 빈 칸 없음 AND 인접(가로·세로) 같은 값 쌍 없음 → 게임오버.

### 점수
- 병합 시 생성된 값만큼 누적. `best=max(best,score)`, 변경 시 localStorage 저장(`try/catch`).

---

## 3. 입력 처리

### 키보드
- `keydown`에서 `ArrowLeft/Right/Up/Down` → `move()`. 방향키는 `preventDefault()`(스크롤 방지). 게임오버 시 무시.

### 터치 스와이프
- 보드에 `touchstart/touchmove/touchend`. `touchmove`는 `{passive:false}` + `preventDefault()`(스크롤·당겨서 새로고침 방지).
- `touchend`에서 `dx,dy` 계산, 임계값 `30px` 미만은 탭으로 무시. `|dx|>|dy|`면 수평(left/right), 아니면 수직(up/down).
- CSS `.board { touch-action: none; }`.

---

## 4. UI / 레이아웃

### 구조
```
header.game-header (h1 "2048", 부제, .scoreboard[점수/최고])
div.controls (button#new-game "새 게임")
div.board-wrap → div.board#board (4×4 grid)
div.overlay#overlay[hidden] (승리/게임오버 + 버튼)
footer → "← 블로그로" (../../index.html)
```

### 렌더 전략(단순안 채택)
- 매 이동마다 보드 타일을 **전부 재생성**. 타일별 슬라이드 이동 애니메이션은 구현하지 않음(의도적). 등장(pop-in)·병합(pulse) 효과만 transient 클래스로.
- 타일은 `div.tile.tile-{값}`, 2048 초과는 `tile-super`. Grid 위치는 인라인 `grid-row/column`.

### 색상 / 반응형 / 테마
- 타일 값별 배경·글자색을 CSS 변수로(낮은 값=크림, 높을수록 러스트/앰버, 글자 밝아짐). 자릿수 많으면 글자 작게(`clamp`).
- `.board-wrap`: `width:min(92vmin,460px); aspect-ratio:1/1; margin-inline:auto`로 정사각·반응형. 헤더/점수판 좁은 화면 flex-wrap.
- `:root`/`[data-theme="dark"]` 팔레트(블로그 크림/에스프레소 톤 차용). `<head>`에 블로그와 동일한 FOUC 방지 인라인 스크립트 복제본(같은 `"theme"` 키 읽음). 토글 버튼은 MVP 제외(시스템/블로그 설정 따름).

---

## 5. 애니메이션 / 피드백
- 등장: `.tile--new` → scale 0→1(0.12s). 병합: `.tile--merged` → pop(1→1.15→1, 0.15s).
- 승리/게임오버: 반투명 오버레이 fade-in + 메시지/버튼. 점수 증가 시 박스 짧은 강조(선택).
- `prefers-reduced-motion: reduce`에서 애니메이션 억제.

---

## 6. 접근성
- 시맨틱 마크업(`header/main/footer`, 실제 `button`, `h1`).
- 점수 영역 `aria-live="polite"`, 승패 오버레이 `role="status"`/`aria-live`.
- 보드 `aria-label` + 조작 안내, `tabindex="0"` 포커스 가능·포커스 링 유지.
- 타일에 숫자 텍스트 항상 표기(색만으로 정보 전달 금지), 충분한 대비.

---

## 7. 검증 방법

### 로컬 서버
- `python3 -m http.server 8000` → `http://localhost:8000/apps/2048/`.

### 테스트 시나리오
1. 초기: 타일 2개, 점수 0, best 복원.
2. 기본 병합: `[2,2,_,_]` ← → 4, +4점.
3. 더블 병합 잠금: `[2,2,2,2]→[4,4]`, `[4,4,2,2]→[8,4]` 등 4종 확인.
4. no-op 게이트: 벽에 붙은 채 같은 방향 → 변화 없음·새 타일 없음.
5. 새 타일 분포(대략 9:1).
6. 승리(2048) 오버레이 + 계속하기.
7. 게임오버(꽉 참 + 병합 불가일 때만).
8. best 영속(새로고침 유지).
9. 새 게임 버튼(초기화, best 유지).
10. 방향키 조작 + 페이지 스크롤 안 됨.
11. 모바일 스와이프 4방향 + 스크롤/새로고침 차단 + 짧은 탭 무시.
12. 반응형(좁은 뷰포트 보드 맞춤).
13. 라이트/다크 가독성.
14. 접근성(점수·승패 알림, 포커스, reduced-motion).

---

## 범위 / 비범위
- **범위**: `/apps/2048/` 내부 파일만 생성. 블로그 다른 파일 미수정.
- **Embed 단계(별도)**: 승인·구현·검증 후 `index.html`에 2048 카드 추가 + 깃 커밋.
