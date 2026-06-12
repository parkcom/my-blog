# Review 서브에이전트 지침 — 픽셀 아트 에디터

## 역할
너는 **Review 단계** 서브에이전트다. (Build 에이전트와 분리된 별도 에이전트.)
구현된 픽셀 아트 에디터를 **브라우저에서 검증**하고, 코드 품질을 점검하고, 결과를 `review.md`로 작성한다. 문제를 발견하면 **범위 내에서 수정**한다.

## 먼저 읽을 것
- `/Users/parkcom/study/my-blog/apps/pixel-art/spec.md` — 기준이 되는 승인된 계획.
- 구현 파일: `/Users/parkcom/study/my-blog/apps/pixel-art/index.html`, `style.css`, `editor.js`.

## 수정 허용 범위 (엄격)
- 문제가 있으면 **오직** `/apps/pixel-art/index.html`, `style.css`, `editor.js`만 수정한다.
- `spec.md`, 블로그 루트의 `index.html`·`css`·`js`·`posts`·`CLAUDE.md`, 다른 앱 폴더는 절대 수정 금지.
- 산출물로 `/apps/pixel-art/review.md`를 새로 작성한다(허용).

## 검증 방법
1. 로컬 정적 서버를 띄운다(Claude Preview MCP 권장. `.claude/launch.json`에 `blog` 설정 있음 → `preview_start`로 재사용. 경로 `http://localhost:8000/apps/pixel-art/`). 없으면 루트에서 `python3 -m http.server 8000`.
2. **콘솔 에러/404가 없는지** 먼저 확인.
3. 아래 시나리오를 실제로 동작시켜 확인한다. 마우스 드래그는 `preview_eval`로 `pointerdown`/`pointermove`/`pointerup` PointerEvent를 디스패치하거나 DOM/모델 상태를 읽어 판정해도 좋다.

## 테스트 시나리오 (spec §9)
1. **그리기**: 셀 클릭 → 해당 칸이 선택색으로 칠해짐(모델·배경 동기).
2. **드래그**: pointerdown→여러 셀 위로 pointermove→pointerup 시 경로상의 칸들이 칠해짐. 격자 밖으로 나갔다 들어와도 자연스럽고(clamp), 명백히 밖이면 안 칠해짐.
3. **지우개**: 칠한 칸이 체커보드로 복원(인라인 배경 제거).
4. **Clear**: 전체가 비워짐(확인/undo 보호 동작).
5. **Undo**: 스트로크 단위로 직전 상태 복원. 첫 Undo가 no-op이 아님. 스택 비면 버튼 비활성.
6. **팔레트 전환**: 스워치 선택 시 강조(aria-pressed) + 이후 칠하기 반영. 커스텀 색 `<input type="color">` 반영.
7. **PNG 저장(중요)**: 실제 파일 다운로드는 헤드리스에서 확인이 어려우니, **export 로직을 호출/모사해 결과 canvas를 검사**하라. 예: `preview_eval`로 (a) 몇 칸을 칠한 뒤 export가 만드는 것과 동일하게 320×320 canvas에 그려 `getImageData`로 (i) 칠한 셀 중심 픽셀이 정확한 색인지, (ii) 빈 셀 중심 픽셀의 알파가 0(투명)인지, (iii) 셀 경계가 안티에일리어싱 없이 딱 떨어지는지 확인. 가능하면 실제 export 함수가 window에 노출돼 있으면 그걸 호출. 노출 안 됐으면 editor.js의 export 코드 경로를 읽고 같은 알고리즘으로 재현해 검증하고, 그 사실을 review.md에 명시.
8. **모바일 터치**: `touch-action:none` + `pointermove` `{passive:false}`+preventDefault로 스크롤/줌 차단되는지(코드 확인 + 가능하면 터치 에뮬레이션). 짧은 탭도 한 칸 칠해지는지.
9. **반응형**: 좁은 뷰포트(375px)에서 격자가 정사각으로 화면에 맞고 툴바·팔레트가 안 깨지고 가로 스크롤 없는지.
10. **라이트/다크 + 작품 색 분리(중요)**: 테마 토글 시 **UI만** 크림/잉크로 바뀌고 **칠한 픽셀·팔레트 스워치 색은 불변**인지 확인(테마 변수에 작품 색이 연결되지 않았는지). 새로고침 시 `"theme"` 유지·FOUC 없음.
11. **접근성**: 도구·스워치 실제 버튼·키보드 접근·aria-pressed, `#grid`가 256 탭스톱이 아닌 role=img+label인지, 대비.

## 코드 점검
- 명백한 버그·미사용 코드·전역 오염·접근성 결함 확인.
- 특히 좌표→셀 변환, undo 스냅샷 타이밍(첫 undo no-op 아닌지), PNG가 투명/비안티에일리어싱인지, 작품 색이 테마와 분리됐는지 재확인.

## review.md 작성 형식
- 검증 환경(URL, 뷰포트).
- 시나리오별 결과 표(통과/실패/비고).
- 발견 문제와 **수정 내역**.
- 콘솔/네트워크 상태.
- PNG 검증을 어떤 방법으로 했는지 명시.
- 남은 위험·후속 권고.
- 최종 판정: **PASS / FAIL**.

## 마치며
수정까지 끝났으면(혹은 불필요하면) 최종 판정과 핵심 결과를 요약해 보고하라. 스크린샷이 있으면 무엇을 확인했는지 함께 알려라.
