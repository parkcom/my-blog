# Review — 픽셀 아트 에디터

Review 단계 서브에이전트가 `spec.md` 기준으로 구현(`index.html`, `style.css`, `editor.js`)을
브라우저에서 검증한 결과다.

## 검증 환경

- URL: `http://localhost:8000/apps/pixel-art/` (Claude Preview MCP, `.claude/launch.json`의 `blog` 서버 재사용)
- 데스크톱 뷰포트 + 모바일 뷰포트(375×812)에서 검증.
- 검증 방식: `preview_eval`로 실제 `#grid`에 `PointerEvent`(pointerdown/move/up, 일관된 `pointerId:1`)를
  디스패치하고, 모델 노출이 없는 ES 모듈이므로 **DOM 셀의 인라인 `backgroundColor`와 `getComputedStyle`로 상태 판정**.
- 콘솔/네트워크: 로드 직후와 전체 시나리오 수행 후 모두 **에러 0, 실패 요청 0**. ("No active pointer" 예외도 발생하지 않음.)

## 시나리오별 결과

| # | 시나리오 | 결과 | 비고 |
|---|----------|------|------|
| 1 | 그리기(단일 클릭) | PASS | 셀(3,3) 클릭 → `rgb(228,59,68)`(#e43b44) 칠해짐 |
| 2 | 드래그 페인트 + clamp | PASS | (5,5)→(9,5) 경로 5칸 모두 칠해짐. 격자 5칸 아래로 벗어난 move는 −1 반환되어 건너뜀(명백히 밖). 가장자리 1셀 오버슈트는 clamp로 흡수 |
| 3 | 지우개(체커보드 복원) | PASS | 칠한 셀 지우개 → 인라인 `background-color` 완전 제거(`style` 속성 빈 값), 계산값이 체커보드 변수로 복귀 |
| 4 | Clear | PASS | `confirm()=true` → 전체 비움(3→0), Clear 직전 스냅샷 undo 푸시. `confirm()=false` → 그대로 유지(3). undo로 복원(→3) |
| 5 | Undo | PASS | 스트로크 단위 복원. **첫 undo가 no-op 아님**(pre-stroke 스냅샷을 `endStroke`에서 커밋하는 설계). 스택 비면 버튼 `disabled`로 전환 확인 |
| 6 | 팔레트/커스텀색 | PASS | 스워치 선택 시 `aria-pressed=true`(정확히 1개), 펜 자동 전환, 이후 칠하기 반영(녹색 `rgb(99,199,77)`). 커스텀 `#123456` → `rgb(18,52,86)` 칠해짐, 팔레트 외 색이라 눌린 스워치 0개 |
| 7 | PNG 저장 | PASS | 아래 "PNG 검증" 참조. 320×320, 색 일치, 빈 칸 알파 0, 안티에일리어싱 없음 |
| 8 | 모바일 터치 차단 | PASS | `#grid` `touch-action:none`, body `user-select:none`, drawing 중 `pointermove`가 `defaultPrevented=true`(passive:false + preventDefault). 짧은 탭도 한 칸 칠해짐(시나리오 1) |
| 9 | 반응형 375px | PASS | `scrollWidth(375) == clientWidth(375)`, 가로 스크롤 없음. 격자 345×345 정사각, 뷰포트 내(우측 끝 365<375). 툴바 줄바꿈·팔레트 안 깨짐 |
| 10 | 라이트/다크 + 작품 색 분리 | PASS | 테마 토글 시 body·체커보드 빈 칸 색만 변함. **칠한 픽셀(`rgb(18,52,86)`)·팔레트 스워치(`rgb(228,59,68)`)는 토글 전후 바이트 동일**. `localStorage["theme"]="dark"` 설정 후 **실제 `location.reload()` → `data-theme="dark"` 복원·일치 확인**(인라인 FOUC 스크립트가 페인트 전 적용, body bg 다크값) |
| 11 | 접근성 | PASS | `#grid` role=img + aria-label, tabIndex −1(256 탭스톱 아님), 셀 비탭. 도구·스워치 모두 실제 `<button>` + `aria-pressed` + `aria-label`. 커스텀 `<input>`, 뒤로 `<a>`, 토글 라벨. 키보드 포커스+활성화 동작. (대비는 정량 측정 안 함 — 블로그 크림/잉크 테마를 상속하므로 별도 검증 생략) |

## PNG 검증 방법 (중요)

`savePNG()`가 ES 모듈 내부 함수라 `window`에 노출되지 않으므로, **`editor.js`의 export 코드 경로와
동일한 알고리즘을 `preview_eval`에서 재현**했다(이 사실을 본 보고서에 명시). 재현 내용:

- 단일 진실원과 동일하게 **DOM 셀의 인라인 `backgroundColor`를 읽어** `pixels` 모델 재구성(빈 칸 = `null`).
- `SCALE=20`, 320×320 offscreen canvas, `imageSmoothingEnabled=false`, 빈 칸 건너뜀, 칠한 칸만 `fillRect(col*20,row*20,20,20)` — editor.js와 동일.
- `getImageData`로 검사한 결과:
  - (i) 칠한 셀 중심 픽셀이 정확한 RGB + 알파 255: 예) #123456 → `[18,52,86,255]`, #63c74d → `[99,199,77,255]`. 전수 일치.
  - (ii) 빈 셀 중심 픽셀 알파 0(투명) 확인.
  - (iii) 셀 경계: 칠한 셀 마지막 px `[18,52,86,255]` → 인접 빈 셀 첫 px `[0,0,0,0]`로 딱 떨어짐(안티에일리어싱 없음).
  - 320×320 전체 픽셀 스캔에서 **부분 알파(0<a<255) 픽셀 0개** → 안티에일리어싱·블렌딩 전무.

## 발견 문제 / 수정 내역

- **발견 문제 없음.** 11개 시나리오 전부 통과, 콘솔 에러 0.
- 따라서 `index.html`·`style.css`·`editor.js` **수정 없음**(범위 내 변경 불필요).
- 사전 우려였던 375px 가로 오버플로는 **실측 결과 발생하지 않음**(`scrollWidth==clientWidth==375`).
  `.grid-wrap`은 `min(92vw,480px)=345px`로 `.editor` 콘텐츠 박스(335px)보다 넓지만,
  `margin-inline:auto`로 좌우 20px(=editor padding) 안에 들어와 뷰포트(375) 내에 정렬되어 문서 오버플로를 만들지 않음.

## 콘솔 / 네트워크 상태

- 콘솔: 에러/경고 0 (로드 직후 및 전체 상호작용 후).
- 네트워크: 실패(4xx/5xx) 요청 0, 404 없음.

## 남은 위험 / 후속 권고

- 합성 PointerEvent 검증의 한계상 **실제 손가락 터치 드래그/핀치줌**은 물리 디바이스에서 한 번 더 확인하면 좋음
  (코드상 `touch-action:none` + `preventDefault`로 차단되며 동작은 검증됨).
- `confirm()` 기반 Clear는 사양(§5)대로 undo로도 보호되므로 충분. 향후 커스텀 모달 도입은 선택 사항.
- 범위 외이지만, 실제 PNG 다운로드(`a.click()` + `toBlob`)는 헤드리스 한계로 export canvas 검사로 대체했음.

## 최종 판정

**PASS**
