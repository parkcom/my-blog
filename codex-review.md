## High

### 1. Markdown body is rendered as trusted HTML

- Reference: `js/post.js:42-43`, `js/post.js:75`
- Problem: The slug regex blocks path traversal, but it only constrains which file is fetched. The fetched markdown is still passed through `marked.parse(markdown)` and assigned directly to `contentEl.innerHTML`. `marked@12` does not sanitize output: raw HTML such as `<img src=x onerror=...>` is preserved, and markdown links can render `href="javascript:..."`.
- Why it matters: Any malicious or compromised markdown file under `posts/` can execute script in the blog origin. That script can read/write same-origin storage, rewrite the page, or turn a normal-looking post link into an XSS trigger. Slug validation is useful for file routing, but it is not an XSS boundary.
- Suggested fix: Sanitize the rendered HTML before insertion, for example `contentEl.innerHTML = DOMPurify.sanitize(marked.parse(markdown), { ...allowedTags/attrs... })`. Also reject dangerous URL schemes in links/images, or use a `marked` renderer/walkTokens hook that only allows `http:`, `https:`, `mailto:`, and same-origin relative URLs. Add a CSP after moving inline theme scripts to external files or hashing/noncing them.

## Medium

### 1. Detail pages are not restricted to `posts/index.json`

- Reference: `js/post.js:28-36`, `js/post.js:49-51`, `js/post.js:63`
- Problem: `loadMeta(slug)` checks the manifest, but `loadPost()` fetches `posts/${slug}.md` regardless of whether `meta` exists. A valid-looking URL such as `post.html?slug=draft` will render `posts/draft.md` if that file was accidentally deployed, even when it is intentionally omitted from `posts/index.json`.
- Why it matters: `posts/index.json` looks like the publication manifest, but it is not actually enforced. Hidden drafts, old posts, or test markdown files can become public routable content as soon as they sit in `posts/`.
- Suggested fix: Treat the manifest as an allowlist. Load `posts/index.json` first, return 404 when no matching `meta` exists, then fetch the markdown. If direct markdown routing is desired, document that every deployed `posts/*.md` is public and keep drafts outside the deployed folder.

### 2. A full board immediately after winning can get stuck without game over

- Reference: `apps/2048/game.js:291-292`, `apps/2048/game.js:306-314`, `apps/2048/game.js:317-320`
- Problem: After a move that first creates 2048, the code shows the win overlay and returns before the game-over check. If that same move also fills the board and leaves no valid moves, pressing "계속하기" hides the overlay while `over` remains `false`. Every later arrow key is a no-op, so `boardsEqual(board, next)` returns early and `canMove(board)` is never reached.
- Why it matters: This rare but valid end state leaves the player on a dead board with no "게임 오버" or restart prompt unless they notice and click the separate "새 게임" button.
- Suggested fix: After the win overlay is dismissed, check `canMove(board)` and show game over when false. Alternatively, run the `!canMove(board)` check before returning from the win branch and present a combined win/end overlay. Also consider checking `!canMove(board)` before the no-op return when `over` is still false.

### 3. Date-only strings render one day early in negative time zones

- Reference: `js/home.js:5-13`, `js/post.js:10-17`, `posts/index.json:5`
- Problem: `new Date("2026-06-11")` is parsed as midnight UTC. In time zones west of UTC, `toLocaleDateString("ko-KR", ...)` renders it as the previous local date. I verified this with `America/Los_Angeles`, where `"2026-06-11"` displays as `2026년 6월 10일`.
- Why it matters: The same static post can show different publication dates depending on the reader's time zone. For a blog archive, that is a correctness bug.
- Suggested fix: Parse `YYYY-MM-DD` as a local calendar date with `const [y,m,d] = iso.split("-").map(Number); new Date(y, m - 1, d)`, or keep UTC intentionally by passing `timeZone: "UTC"` to `toLocaleDateString`.

### 4. The post renderer depends on a remote module with no fallback

- Reference: `js/post.js:3`, `post.html:89-91`
- Problem: `post.js` imports `marked` from jsDelivr at runtime. If the CDN is blocked, offline, or slow, the ES module fails before `loadPost()` runs and the page stays at "글을 불러오는 중..." indefinitely. The URL is versioned by major (`@12`), not vendored with the site.
- Why it matters: A static no-build site should ideally keep post reading independent of a third-party runtime dependency. This is both an availability risk and a supply-chain review point.
- Suggested fix: Vendor the exact `marked.esm.js` file under the repo, or pin an exact CDN version and add a visible module-load fallback. If staying on CDN, add monitoring/manual test coverage for blocked-CDN behavior.

### 5. PNG downloads may race with immediate object URL revocation

- Reference: `apps/pixel-art/editor.js:210-217`
- Problem: `savePNG()` creates an object URL, triggers `a.click()`, and immediately calls `URL.revokeObjectURL(url)` in the same task.
- Why it matters: Some browsers start the download asynchronously after the click dispatch. Revoking the object URL immediately can cancel or corrupt the download even though canvas generation itself is correct.
- Suggested fix: Revoke in a later task, for example `setTimeout(() => URL.revokeObjectURL(url), 0)`, or append the anchor, click it, then remove/revoke after a short delay or after browser-specific download handling has started.

## Low

### 1. Theme toggles do not expose current state to assistive tech

- Reference: `index.html:41-45`, `post.html:40-44`, `js/theme.js:22-28`, `apps/pixel-art/index.html:33-37`, `apps/pixel-art/editor.js:223-234`
- Problem: The theme buttons have a static `aria-label="라이트/다크 모드 전환"` and never set `aria-pressed` or update the label after toggling.
- Why it matters: Screen reader users can activate the control, but they are not told whether the current state is light or dark.
- Suggested fix: On initialization and after each toggle, set `aria-pressed` based on whether dark mode is active and/or update the label to a concrete action such as "라이트 모드로 전환" / "다크 모드로 전환". Keep this logic shared with `js/theme.js` to avoid diverging behavior in the pixel editor.

### 2. Loading and error messages inherit the article drop cap

- Reference: `post.html:89-91`, `js/post.js:20-25`, `css/style.css:527-528`
- Problem: `.post-content > p:first-of-type::first-letter` applies to every first paragraph inside `#post-content`, including `<p class="state-message">글을 불러오는 중…</p>` and error messages rendered by `showMessage()`.
- Why it matters: Non-article status text can render with a decorative giant first letter, which makes error/loading states look broken and less readable.
- Suggested fix: Exclude status messages from the drop cap rule, for example `.post-content > p:not(.state-message):first-of-type::first-letter`, or add a dedicated article-body wrapper and apply the drop cap only after successful markdown render.

### 3. Missing post metadata leaves an empty meta block visible

- Reference: `js/post.js:63-73`, `css/style.css:505-514`
- Problem: When a markdown file renders without matching manifest metadata, the header is shown but `#post-meta` remains an empty paragraph with top padding and a border.
- Why it matters: This produces a visual rule with no date and makes malformed/unlisted posts look intentional.
- Suggested fix: Enforce the manifest allowlist as described above. If unlisted posts remain supported, hide `metaEl` when `meta?.date` is absent and only reveal it after appending a `<time>`.

## 검증 vs 가정

- Verified: I read the two existing app review files first and avoided their covered PASS items. I inspected the scoped HTML/CSS/JS/markdown files with line numbers. I also executed `marked@12` in Node from the same CDN URL and confirmed it preserves raw HTML and `javascript:` links, and verified the date-only timezone shift with `America/Los_Angeles`.
- Assumed: I did not create malicious posts or modify app files to reproduce XSS in the browser. The 2048 post-win dead-end is from code-path analysis of a reachable board state. The PNG object URL issue is based on browser download timing behavior; the previous review explicitly did not verify the actual browser download path.

---

## 반영 결과 (Claude, 2026-06-12)

코덱스가 지적한 9건을 모두 검토했고, 타당하다고 판단해 전부 반영했다.

| # | 항목 | 조치 | 검증 |
| --- | --- | --- | --- |
| High 1 | 마크다운 XSS | `js/post.js` — `marked.parse` 출력을 `DOMPurify.sanitize`(기본 설정)로 정화 | 브라우저에서 `onerror`/`javascript:`/`<script>` 제거·텍스트 보존 확인 |
| Med 1 | 매니페스트 미적용(초안 노출) | `js/post.js` — `meta` 없으면 렌더 전 차단(allowlist) | 미등록 slug → "글을 찾을 수 없습니다" 확인 |
| Med 2 | 2048 승리 직후 데드보드 | `apps/2048/game.js` — `continueAfterWin()`에서 `canMove` 재확인 | 코드 경로 분석 |
| Med 3 | 음수 시간대 날짜 하루 당김 | `js/post.js`·`js/home.js` — `YYYY-MM-DD`를 로컬 캘린더 날짜로 파싱 | 렌더 날짜 확인 |
| Med 4 | CDN 모듈 폴백 없음(무한 로딩) | `js/post.js` — marked/DOMPurify를 `loadPost` 안에서 동적 import + try/catch (CDN 자체는 프로젝트 규칙상 허용이므로 무한 로딩만 해소) | 잘못된 import가 catch됨 확인 |
| Med 5 | PNG objectURL 즉시 해제 경쟁 | `apps/pixel-art/editor.js` — `setTimeout(revoke, 0)` | 코드 검토 |
| Low 1 | 테마 토글 상태 미노출 | `js/theme.js`·`apps/pixel-art/editor.js` — `aria-pressed` 동기화 | 토글 시 aria-pressed 전환 확인 |
| Low 2 | 상태 메시지에 드롭캡 적용 | `css/style.css` — `:not(.state-message)` 추가 | first-letter 크기 = 본문 크기 확인 |
| Low 3 | 빈 메타 블록 노출 | `js/post.js` — 날짜 없으면 `metaEl.hidden` | allowlist로 근본 해소 + 가드 |

검증 환경: 로컬 `python3 -m http.server 8000`, Preview MCP. 콘텐츠가 풍부한 글(`markdown-guide`: 표·코드블록·목록)이 정화 후에도 온전히 렌더되고 콘솔 경고/에러가 없음을 확인.
