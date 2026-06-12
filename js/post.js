// 개별 글: ?slug=... 로 마크다운을 fetch해 marked로 렌더한다.
// marked·DOMPurify는 버전 고정 CDN(ESM)을 loadPost 안에서 동적 import한다 —
// CDN 차단/오프라인 시 모듈 로드 실패로 무한 로딩에 빠지지 않고 에러를 보이기 위함.

const headerEl = document.getElementById("post-header");
const titleEl = document.getElementById("post-title");
const metaEl = document.getElementById("post-meta");
const contentEl = document.getElementById("post-content");

function formatDate(iso) {
  // "YYYY-MM-DD"는 new Date()에서 UTC 자정으로 해석돼 음수 시간대에선
  // 하루 당겨진다. 로컬 캘린더 날짜로 직접 파싱해 독자 시간대와 무관하게 한다.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function showMessage(text) {
  contentEl.innerHTML = "";
  const p = document.createElement("p");
  p.className = "state-message";
  p.textContent = text;
  contentEl.appendChild(p);
}

async function loadMeta(slug) {
  try {
    const res = await fetch("posts/index.json");
    if (!res.ok) return null;
    const posts = await res.json();
    return Array.isArray(posts) ? posts.find((p) => p.slug === slug) : null;
  } catch {
    return null;
  }
}

async function loadPost() {
  const slug = new URLSearchParams(location.search).get("slug");

  // slug 형식 제한: 경로 조작/임의 파일 요청 방지.
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    document.title = "글을 찾을 수 없습니다 · My Blog";
    showMessage("유효하지 않은 주소입니다.");
    return;
  }

  // 매니페스트(posts/index.json)를 발행 허용 목록으로 취급한다.
  // 목록에 없는 slug는 posts/에 파일이 남아 있어도 공개 라우팅하지 않는다(초안 보호).
  const meta = await loadMeta(slug);
  if (!meta) {
    document.title = "글을 찾을 수 없습니다 · My Blog";
    showMessage("글을 찾을 수 없습니다.");
    return;
  }

  let markdown, marked, DOMPurify;
  try {
    const mdRes = await fetch(`posts/${slug}.md`);
    if (!mdRes.ok) throw new Error(`HTTP ${mdRes.status}`);
    markdown = await mdRes.text();
    ({ marked } = await import(
      "https://cdn.jsdelivr.net/npm/marked@12/lib/marked.esm.js"
    ));
    DOMPurify = (
      await import("https://cdn.jsdelivr.net/npm/dompurify@3/dist/purify.es.mjs")
    ).default;
  } catch (err) {
    console.error(err);
    document.title = "글을 찾을 수 없습니다 · My Blog";
    showMessage("글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    return;
  }

  // 헤더(제목/날짜)는 매니페스트 메타에서 채운다.
  const title = meta.title || slug;
  document.title = `${title} · My Blog`;
  titleEl.textContent = title;
  if (meta.date) {
    metaEl.innerHTML = "";
    const time = document.createElement("time");
    time.dateTime = meta.date;
    time.textContent = formatDate(meta.date);
    metaEl.appendChild(time);
    metaEl.hidden = false;
  } else {
    // 날짜가 없으면 빈 메타 블록(테두리만 남는 줄)을 숨긴다.
    metaEl.hidden = true;
  }
  headerEl.hidden = false;

  // marked 출력을 신뢰하지 않고 DOMPurify 기본 설정으로 정화한다.
  // (스크립트·이벤트 핸들러·javascript: URL 제거. 표준 마크다운 HTML은 보존.)
  contentEl.innerHTML = DOMPurify.sanitize(marked.parse(markdown));
}

loadPost();
