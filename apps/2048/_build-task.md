# Build 서브에이전트 지침 — 2048 게임

## 역할
너는 **Build 단계** 서브에이전트다. 승인된 계획대로 2048 게임을 **구현**한다.

## 먼저 읽을 것
- `/Users/parkcom/study/my-blog/apps/2048/spec.md` — 승인된 구현 계획. 이 계획을 그대로 따른다.
- (참고용, 수정 금지) `/Users/parkcom/study/my-blog/css/style.css`, `/Users/parkcom/study/my-blog/index.html` — 블로그 테마 변수·FOUC 인라인 스크립트 패턴 차용용.

## 수정 허용 범위 (엄격)
다음 3개 파일만 **생성/수정**한다:
- `/Users/parkcom/study/my-blog/apps/2048/index.html`
- `/Users/parkcom/study/my-blog/apps/2048/style.css`
- `/Users/parkcom/study/my-blog/apps/2048/game.js`

**그 외 어떤 파일도 건드리지 마라.** 특히 블로그 루트의 `index.html`, `css/`, `js/`, `posts/`, `CLAUDE.md`, `spec.md`는 수정 금지. (메인 페이지 카드 추가/깃 커밋은 이후 Embed 단계에서 부모가 한다.)

## 구현 요구사항 (spec.md 핵심 재확인)
- 순수 HTML/CSS/JS(ES 모듈). 외부 라이브러리·CDN 0. 프레임워크·번들러 금지.
- 4×4 보드, 방향키로 밀어 같은 숫자 병합. **더블 병합 잠금** 반드시 보장:
  - `[2,2,2,2] → [4,4,0,0]`, `[4,4,2,2] → [8,4,0,0]`, `[2,2,2,0] → [4,2,0,0]`, `[2,0,2,2] → [4,2,0,0]`
- **no-op 게이트**: 이동으로 보드가 바뀐 경우에만 새 타일 생성·점수 반영·렌더.
- 새 타일: 빈 칸 무작위, 90% `2` / 10% `4`. 시작 시 2개.
- 점수판: 현재 점수 + 최고 점수(localStorage `2048-best`, try/catch).
- 승리(2048, 계속하기 가능) / 게임오버(빈 칸 없음 AND 인접 병합 불가).
- **키보드 방향키 + 모바일 터치 스와이프**(touchmove `{passive:false}`+preventDefault, 임계값 30px, `.board{touch-action:none}`). 방향키 preventDefault로 페이지 스크롤 방지.
- 반응형(`.board-wrap: width:min(92vmin,460px); aspect-ratio:1/1`), 타일 값별 색, 등장/병합 애니메이션, `prefers-reduced-motion` 대응.
- 라이트/다크 테마: `:root`/`[data-theme="dark"]` 팔레트 + `<head>`에 블로그와 동일한 FOUC 방지 인라인 테마 스크립트(같은 `"theme"` 키 읽기). 푸터에 `← 블로그로`(`../../index.html`) 링크.
- 접근성: 시맨틱 마크업, 점수 `aria-live`, 승패 알림, 보드 포커스 가능, 숫자 텍스트 표기.

## 코드 컨벤션
- 들여쓰기 스페이스 2칸. ES 모듈. 전역 오염 회피. 주석은 "왜"만 간결히.

## 마치며
구현을 끝내면, 만든 파일과 주요 설계 결정(특히 더블 병합 잠금·no-op 게이트·스와이프 처리)을 요약해 보고하라. **로컬 서버 실행이나 브라우저 검증은 하지 마라 — 그것은 Review 단계의 일이다.** (단, 명백한 문법 오류가 없는지는 스스로 확인하라.)
