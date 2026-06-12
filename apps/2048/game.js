// 2048 — 순수 ES 모듈. 외부 의존 0.
// 모든 이동을 "왼쪽 밀기"로 환원하고, 다른 방향은 보드를 변형해 적용 후 되돌린다.

const SIZE = 4;
const WIN_VALUE = 2048;
const STORAGE_KEY_BEST = "2048-best";
const SWIPE_THRESHOLD = 30; // px

// --- DOM 참조 ---
const boardEl = document.getElementById("board");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlayEl = document.getElementById("overlay");
const overlayMsgEl = document.getElementById("overlay-message");
const overlayActionsEl = document.getElementById("overlay-actions");
const newGameBtn = document.getElementById("new-game");

// --- 상태 ---
let board = emptyBoard();
let score = 0;
let best = loadBest();
let won = false; // 2048 도달 후 "계속하기"를 누르면 true로 래치 (오버레이 재발생 방지)
let over = false;

// 다음 렌더에서 강조할 셀들 (이동 결과로 채워짐)
let spawnCell = null; // { r, c }
let mergedCells = []; // [{ r, c }, ...]

// ============================================================
// 보드 유틸
// ============================================================
function emptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneBoard(b) {
  return b.map((row) => row.slice());
}

function boardsEqual(a, b) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

function transpose(b) {
  const out = emptyBoard();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      out[c][r] = b[r][c];
    }
  }
  return out;
}

function reverseRows(b) {
  return b.map((row) => row.slice().reverse());
}

// ============================================================
// 한 행 왼쪽 밀기 — 더블 병합 잠금 보장
//   compact(0 제거) 후 walk 하며 인접 같은 값만 1회 병합하고 2칸 전진.
//   한 이동에서 어떤 타일도 두 번 병합되지 않는다.
//   반환: { row, gained, mergedCols } (mergedCols: 병합 결과 타일의 열 인덱스)
// ============================================================
function slideRowLeft(row) {
  const compact = row.filter((v) => v !== 0);
  const result = [];
  const mergedCols = [];
  let gained = 0;

  for (let i = 0; i < compact.length; i++) {
    if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
      const merged = compact[i] * 2;
      result.push(merged);
      mergedCols.push(result.length - 1);
      gained += merged;
      i++; // 다음 칸 소비 → 더블 병합 방지
    } else {
      result.push(compact[i]);
    }
  }
  while (result.length < SIZE) result.push(0);

  return { row: result, gained, mergedCols };
}

// ============================================================
// 방향별 이동 — 좌표 변환 메타로 일반화
//   각 방향에 대해 (forward 변환들, inverse 변환들)을 정의하고,
//   forward 후 행별 slideRowLeft → inverse 로 원좌표 복귀.
//   병합/이동 위치도 같은 inverse 좌표 매핑을 거쳐 원본 좌표로 환산한다.
// ============================================================

// 원본 (r,c) → 변형 좌표 (r',c') 매핑.
// c'(변형 열)는 슬라이드 순서를 인코딩한다: 목표 가장자리에 가장 가까운 칸이 c'=0.
// 그래야 "왼쪽 밀기"가 곧 해당 방향 밀기가 된다.
// left:  목표=왼쪽 가장자리 → (r, c)
// right: 목표=오른쪽       → (r, SIZE-1-c)
// up:    목표=위           → (c, r)
// down:  목표=아래         → (c, SIZE-1-r)
const DIR_MAP = {
  left: (r, c) => [r, c],
  right: (r, c) => [r, SIZE - 1 - c],
  up: (r, c) => [c, r],
  down: (r, c) => [c, SIZE - 1 - r],
};

function applyMove(b, dir) {
  // 변형 보드(grid')를 만든다: grid'[r'][c'] = b[원본]
  const map = DIR_MAP[dir];
  const grid = emptyBoard();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const [tr, tc] = map(r, c);
      grid[tr][tc] = b[r][c];
    }
  }

  // 변형 좌표계에서 각 행을 왼쪽으로 민다.
  const moved = emptyBoard();
  const mergedTransformed = []; // [{ r', c' }]
  let gained = 0;
  for (let r = 0; r < SIZE; r++) {
    const { row, gained: g, mergedCols } = slideRowLeft(grid[r]);
    moved[r] = row;
    gained += g;
    for (const c of mergedCols) mergedTransformed.push({ r, c });
  }

  // inverse: 변형 좌표 (r',c')를 원본 (r,c)로 되돌린다.
  // map 은 단사이므로 역매핑 테이블을 만들어 적용.
  const inverse = buildInverse(map);
  const result = emptyBoard();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const [or, oc] = inverse[r][c];
      result[or][oc] = moved[r][c];
    }
  }
  const merged = mergedTransformed.map(({ r, c }) => {
    const [or, oc] = inverse[r][c];
    return { r: or, c: oc };
  });

  return { board: result, gained, merged };
}

// 변형 좌표 → 원본 좌표 역매핑 테이블 생성
function buildInverse(map) {
  const inv = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const [tr, tc] = map(r, c);
      inv[tr][tc] = [r, c];
    }
  }
  return inv;
}

// ============================================================
// 새 타일 / 이동 가능 여부
// ============================================================
function emptyCells(b) {
  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (b[r][c] === 0) cells.push({ r, c });
    }
  }
  return cells;
}

function spawnTile(b) {
  const cells = emptyCells(b);
  if (cells.length === 0) return null;
  const { r, c } = cells[Math.floor(Math.random() * cells.length)];
  b[r][c] = Math.random() < 0.9 ? 2 : 4;
  return { r, c };
}

// 빈 칸이 없고 인접(가로·세로) 같은 값 쌍도 없으면 이동 불가 → 게임오버
function canMove(b) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (b[r][c] === 0) return true;
      if (c + 1 < SIZE && b[r][c] === b[r][c + 1]) return true;
      if (r + 1 < SIZE && b[r][c] === b[r + 1][c]) return true;
    }
  }
  return false;
}

function hasValue(b, value) {
  return b.some((row) => row.some((v) => v >= value));
}

// ============================================================
// localStorage (try/catch)
// ============================================================
function loadBest() {
  try {
    const v = parseInt(localStorage.getItem(STORAGE_KEY_BEST), 10);
    return Number.isFinite(v) ? v : 0;
  } catch (e) {
    return 0;
  }
}

function saveBest(v) {
  try {
    localStorage.setItem(STORAGE_KEY_BEST, String(v));
  } catch (e) {
    /* 저장 실패는 무시 (시크릿 모드 등) */
  }
}

// ============================================================
// 렌더링 — 매 이동마다 타일 전부 재생성 (슬라이드 애니메이션은 의도적 미구현)
// ============================================================
function render() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);

  boardEl.replaceChildren();

  // 16개 빈 셀 배경
  for (let i = 0; i < SIZE * SIZE; i++) {
    const cell = document.createElement("div");
    cell.className = "cell";
    boardEl.appendChild(cell);
  }

  // 타일
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const value = board[r][c];
      if (value === 0) continue;

      const tile = document.createElement("div");
      const sizeClass = value > 2048 ? "tile-super" : `tile-${value}`;
      tile.className = `tile ${sizeClass}`;
      tile.style.gridRow = String(r + 1);
      tile.style.gridColumn = String(c + 1);
      tile.textContent = String(value);

      if (spawnCell && spawnCell.r === r && spawnCell.c === c) {
        tile.classList.add("tile--new");
      }
      if (mergedCells.some((m) => m.r === r && m.c === c)) {
        tile.classList.add("tile--merged");
      }

      boardEl.appendChild(tile);
    }
  }
}

// ============================================================
// 오버레이
// ============================================================
function showOverlay(message, actions) {
  overlayMsgEl.textContent = message;
  overlayActionsEl.replaceChildren();
  for (const { label, onClick } of actions) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    overlayActionsEl.appendChild(btn);
  }
  overlayEl.hidden = false;
}

function hideOverlay() {
  overlayEl.hidden = true;
}

// ============================================================
// 이동 — no-op 게이트: 변화가 있을 때만 점수·새 타일·렌더
// ============================================================
function move(dir) {
  if (over) return;

  const { board: next, gained, merged } = applyMove(board, dir);

  // 스폰 전에 원본과 비교 (no-op 게이트의 핵심)
  if (boardsEqual(board, next)) return;

  board = next;
  score += gained;
  if (score > best) {
    best = score;
    saveBest(best);
  }

  mergedCells = merged;
  spawnCell = spawnTile(board);

  render();

  // 승리: 2048 최초 도달 (won 래치로 1회만)
  if (!won && hasValue(board, WIN_VALUE)) {
    won = true;
    showOverlay("2048 달성!", [
      { label: "계속하기", onClick: continueAfterWin },
      { label: "새 게임", onClick: startGame },
    ]);
    return;
  }

  // 게임오버
  if (!canMove(board)) {
    over = true;
    showOverlay("게임 오버", [{ label: "다시 시작", onClick: startGame }]);
  }
}

// 승리 후 "계속하기": 그 수가 보드를 꽉 채워 더 둘 수 없으면
// (no-op 게이트 때문에 이후 키 입력으로는 감지되지 않으므로) 여기서 게임오버 처리.
function continueAfterWin() {
  hideOverlay();
  if (!canMove(board)) {
    over = true;
    showOverlay("게임 오버", [{ label: "다시 시작", onClick: startGame }]);
  }
}

// ============================================================
// 게임 시작 / 초기화 (best 유지)
// ============================================================
function startGame() {
  board = emptyBoard();
  score = 0;
  won = false;
  over = false;
  mergedCells = [];
  spawnCell = null;
  spawnTile(board);
  spawnTile(board);
  hideOverlay();
  render();
  boardEl.focus();
}

// ============================================================
// 입력 — 키보드 (window 레벨: 보드 포커스 없이도 조작 가능)
// ============================================================
const KEY_DIR = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

window.addEventListener("keydown", (e) => {
  const dir = KEY_DIR[e.key];
  if (!dir) return; // 방향키만 처리 (Tab 등은 통과 → 포커스 유지)
  e.preventDefault(); // 방향키 페이지 스크롤 방지
  move(dir);
});

// ============================================================
// 입력 — 터치 스와이프
//   touchmove 는 {passive:false} + preventDefault 로 스크롤·당겨서 새로고침 차단.
// ============================================================
let touchStartX = 0;
let touchStartY = 0;
let touchTracking = false;

boardEl.addEventListener(
  "touchstart",
  (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchTracking = true;
  },
  { passive: true }
);

boardEl.addEventListener(
  "touchmove",
  (e) => {
    // 보드 위 제스처는 스크롤/새로고침 대신 게임 입력으로만 쓴다.
    if (touchTracking) e.preventDefault();
  },
  { passive: false }
);

boardEl.addEventListener(
  "touchend",
  (e) => {
    if (!touchTracking) return;
    touchTracking = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < SWIPE_THRESHOLD && absY < SWIPE_THRESHOLD) return; // 탭 무시
    if (absX > absY) {
      move(dx > 0 ? "right" : "left");
    } else {
      move(dy > 0 ? "down" : "up");
    }
  },
  { passive: true }
);

newGameBtn.addEventListener("click", startGame);

// 시작
startGame();
