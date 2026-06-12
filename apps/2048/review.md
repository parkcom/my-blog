# 2048 게임 — Review 결과

검증 단계 서브에이전트가 `spec.md` 기준으로 구현(`index.html`, `style.css`, `game.js`)을
브라우저에서 검증한 기록이다.

## 검증 환경
- 서버: Claude Preview MCP (`.claude/launch.json`의 `blog`), `python3 -m http.server` 계열, 포트 8000.
- URL: `http://localhost:8000/apps/2048/`
- 뷰포트: 데스크톱, 모바일 375×812(반응형), 라이트/다크 색상 에뮬레이션.
- 검증 방식: 실제 `keydown` 디스패치로 라이브 조작 + DOM 상태 판정.
  순수 로직(`slideRowLeft`/`applyMove`/`hasValue`/`spawnTile`)은 실제 `game.js` 소스를
  격리 실행해 spec 케이스로 직접 검증.

## 시나리오별 결과

| # | 시나리오 | 결과 | 비고 |
|---|----------|------|------|
| 1 | 초기: 타일 2개, 점수 0, best 복원 | PASS | 로드 시 보드 자식 18개(셀16+타일2), 점수 0, best는 localStorage에서 복원 확인. |
| 2 | 기본 병합 `[2,2,_,_]`→4, +4점 | PASS | `slideRowLeft([2,2,0,0])=[4,0,0,0]`, gained=4 (실제 소스). |
| 3 | **더블 병합 잠금** | PASS | `[2,2,2,2]→[4,4,0,0]`, `[4,4,2,2]→[8,4,0,0]`, `[2,2,2,0]→[4,2,0,0]`, `[2,0,2,2]→[4,2,0,0]`. 8 미발생. |
| 4 | no-op 게이트 | PASS | 좌측 완전 정렬 상태(`[[8,2,0,0],...]`)에서 ArrowLeft → 보드 동일, 타일 수 불변(5→5), 새 타일 미생성. |
| 5 | 새 타일 분포 ≈ 9:1 | PASS | 실제 `spawnTile` 20,000회: 2가 90.0%, 4가 10.0%. |
| 6 | 승리(2048) 오버레이 + 계속하기 | PASS (코드검증) | 아래 "비고" 참조. 라이브 트리거는 불가하여 소스 검증 + 컴포넌트 재사용으로 확인. |
| 7 | 게임오버(꽉 참 AND 병합 불가일 때만) | PASS | 코너 전략 다회 플레이 → 보드 막힘 시 "게임 오버" 오버레이 발생, `canMove` 가드 동작. |
| 8 | best 영속(새로고침 유지) | PASS | 점수 524 누적 → best 524 저장 → `location.reload()` 후 best 524 복원, 점수 0. |
| 9 | 새 게임 버튼(초기화, best 유지) | PASS | 클릭 시 점수 0, 타일 2개, best 유지, 오버레이 닫힘. |
| 10 | 방향키 조작 + 페이지 스크롤 방지 | PASS | ArrowLeft가 보드 이동 + `defaultPrevented=true`. Tab은 `defaultPrevented=false`(포커스 통과). |
| 11 | 모바일 스와이프 + 스크롤/새로고침 차단 + 탭 무시 | PASS | 소스 확인: `touchmove {passive:false}`+`preventDefault`, 임계값 30px, `|dx|>|dy|` 축 판정, 임계 미만 탭 무시. CSS `touch-action:none`. |
| 12 | 반응형(375px) | PASS | 가로 스크롤 없음(scrollWidth=clientWidth=375), 보드 폭 345px로 뷰포트에 맞음, 글자 깨짐 없음. |
| 13 | 라이트/다크 가독성·대비 | PASS | 라이트: 크림 배경 + 진한 글자. 다크: 에스프레소 배경 + 러스트/앰버 타일 + 밝은 글자, 대비 양호(스크린샷 확인). |
| 14 | 접근성 | PASS | board `tabindex=0`+`aria-label`+포커스 가능, scoreboard `aria-live=polite`, overlay `role=status`+`aria-live=assertive`, CSS에 `prefers-reduced-motion` 블록. |

## 방향 매핑 별도 검증 (코드 점검 §40)
중앙 단일 타일(`[1][1]=2`)에 대해 4방향 각각:
- left → `[1][0]`, right → `[1][3]`, up → `[0][1]`, down → `[3][1]` — 모두 서로 다른 올바른 가장자리.
- 열 병합(up/down)·행 병합(left/right)도 각 방향에서 정상. 어떤 방향도 다른 방향과 동일 동작하지 않음.

## 시나리오 6(승리) 검증 상세
라이브로 2048 타일을 강제 생성할 수단이 없고(게임 내부 `board` 상태는 `window` 미노출),
무작위/코너 전략 플레이로는 4000수 안에 2048 도달 불가(최대 512에서 게임오버)하여
**라이브 트리거는 수행하지 못함.** 대신 다음으로 확인:
- 실제 소스의 `hasValue(b, 2048)`를 격리 실행: 2048 감지 true, 1024 false, 4096(≥2048) true.
- 오버레이 렌더 기구(`showOverlay`)는 동일 코드 경로인 게임오버에서 라이브로 동작 확인됨
  (메시지 표시, 버튼 렌더·클릭→`startGame`).
- `move()` 소스의 승리 분기: `if (!won && hasValue(board, WIN_VALUE)) { won = true; showOverlay("2048 달성!", [계속하기→hideOverlay, 새 게임→startGame]); return; }`
  — `won` 래치로 1회만 발생, 계속하기는 오버레이만 닫고 게임 지속, 이후 수에서는 승리 분기 건너뛰고 `canMove` 게임오버 가드만 동작. 와이어링 정상.

판정: 컴포넌트 재사용 + 소스 검증 근거로 PASS로 본다(라이브 미트리거임을 명시).

## 콘솔 / 네트워크
- 콘솔 로그/에러: 전 과정에서 **없음**(로드·플레이·새로고침·리사이즈 포함).
- 404/네트워크 오류: 없음. `index.html`/`style.css`/`game.js` 정상 로드, 외부 의존 0.

## 발견 문제 / 수정 내역
- **없음.** 구현이 spec과 일치하며 14개 시나리오 모두 통과. `index.html`/`style.css`/`game.js`
  수정 불필요.

## 남은 위험 / 후속 권고
- 게임 내부 상태가 `window`에 노출돼 있지 않아 승리 시나리오의 라이브 E2E 검증이 어렵다.
  (의도적 캡슐화로 판단되며 결함 아님.) 후속으로 테스트 훅(예: `?test` 쿼리 시
  `window.__game` 노출)을 두면 승리 플로우 자동 검증이 가능하나 MVP 범위 밖.
- 기능적 위험 없음.

## 최종 판정: **PASS**
