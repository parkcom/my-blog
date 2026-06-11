// 개별 글: ?slug=... 로 마크다운을 fetch해 marked로 렌더한다.
// 버전 고정 CDN(ESM) — 빌드/번들 없이 브라우저에서 바로 동작.
import { marked } from "https://cdn.jsdelivr.net/npm/marked@12/lib/marked.esm.js";

const headerEl = document.getElementById("post-header");
const titleEl = document.getElementById("post-title");
const metaEl = document.getElementById("post-meta");
const contentEl = document.getElementById("post-content");

function formatDate(iso) {
  const d = new Date(iso);
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

  const [meta, mdRes] = await Promise.all([
    loadMeta(slug),
    fetch(`posts/${slug}.md`).catch(() => null),
  ]);

  if (!mdRes || !mdRes.ok) {
    document.title = "글을 찾을 수 없습니다 · My Blog";
    showMessage("글을 찾을 수 없습니다.");
    return;
  }

  const markdown = await mdRes.text();

  // 헤더(제목/날짜)는 매니페스트 메타에서 채운다.
  const title = meta?.title || slug;
  document.title = `${title} · My Blog`;
  titleEl.textContent = title;
  if (meta?.date) {
    metaEl.innerHTML = "";
    const time = document.createElement("time");
    time.dateTime = meta.date;
    time.textContent = formatDate(meta.date);
    metaEl.appendChild(time);
  }
  headerEl.hidden = false;

  contentEl.innerHTML = marked.parse(markdown);
}

loadPost();
