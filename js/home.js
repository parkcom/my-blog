// 홈: posts/index.json 매니페스트를 읽어 글 목록을 렌더한다.

const listEl = document.getElementById("post-list");

function formatDate(iso) {
  // "YYYY-MM-DD"는 UTC 자정으로 해석돼 음수 시간대에서 하루 당겨진다.
  // 로컬 캘린더 날짜로 직접 파싱해 독자 시간대와 무관하게 표시한다.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// 사용자 입력값을 텍스트로 안전하게 넣기 위해 DOM API로 조립한다(문자열 innerHTML 지양).
function renderPost(post) {
  const li = document.createElement("li");
  li.className = "post-card";

  const title = document.createElement("h2");
  title.className = "post-card__title";
  const link = document.createElement("a");
  link.href = `post.html?slug=${encodeURIComponent(post.slug)}`;
  link.textContent = post.title;
  title.appendChild(link);

  const meta = document.createElement("p");
  meta.className = "post-card__meta";
  if (post.date) {
    const time = document.createElement("time");
    time.dateTime = post.date;
    time.textContent = formatDate(post.date);
    meta.appendChild(time);
  }

  li.append(title, meta);

  if (post.summary) {
    const summary = document.createElement("p");
    summary.className = "post-card__summary";
    summary.textContent = post.summary;
    li.appendChild(summary);
  }

  return li;
}

function showMessage(text) {
  listEl.innerHTML = "";
  const li = document.createElement("li");
  li.className = "state-message";
  li.textContent = text;
  listEl.appendChild(li);
}

async function loadPosts() {
  try {
    const res = await fetch("posts/index.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const posts = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) {
      showMessage("아직 작성된 글이 없습니다.");
      return;
    }

    // 날짜 내림차순(최신 글 먼저).
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    listEl.innerHTML = "";
    for (const post of posts) {
      listEl.appendChild(renderPost(post));
    }
  } catch (err) {
    console.error(err);
    showMessage("글 목록을 불러오지 못했습니다. 로컬 서버에서 실행 중인지 확인해 주세요.");
  }
}

loadPosts();
