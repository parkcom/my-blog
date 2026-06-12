// 픽셀 아트 에디터 — 순수 ES 모듈. 외부 라이브러리/CDN 없음.
//
// 단일 진실원: 길이 256 배열 `pixels`(hex 문자열 또는 null=빈 칸).
// 화면 격자(DOM)와 PNG 내보내기(별도 canvas)는 모두 이 배열만 본다.

const GRID = 16;
const N = GRID * GRID;
const SCALE = 20; // 셀당 20px → 320×320 PNG

// 테마 무관 고정 14색 팔레트. 작품 색이므로 절대 CSS 변수에 연결하지 않는다.
const PALETTE = [
  "#000000", "#ffffff", "#7f7f7f", "#e43b44", "#f77622", "#feae34", "#63c74d",
  "#3e8948", "#0099db", "#124e89", "#b55088", "#ffadce", "#a05b53", "#c0cbdc",
];

// ---- 모델 / 상태 ----
const pixels = new Array(N).fill(null);
let tool = "pen"; // "pen" | "eraser"
let selectedColor = "#e43b44";

// undo: 스트로크/Clear "직전" 스냅샷 스택 (최대 30)
const UNDO_MAX = 30;
const undoStack = [];

// 드래그 상태
let drawing = false;
let lastI = -1;
let strokeBefore = null; // pointerdown 시점의 pre-stroke 스냅샷

// ---- DOM 참조 ----
const grid = document.getElementById("grid");
const swatchesEl = document.getElementById("swatches");
const customColor = document.getElementById("custom-color");
const penBtn = document.getElementById("tool-pen");
const eraserBtn = document.getElementById("tool-eraser");
const undoBtn = document.getElementById("undo");
const clearBtn = document.getElementById("clear");
const saveBtn = document.getElementById("save");
const themeToggle = document.querySelector(".theme-toggle");

const cells = []; // 인덱스 → 셀 div

// ---- 격자 생성 ----
function buildGrid() {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < N; i++) {
    const row = (i / GRID) | 0;
    const col = i % GRID;
    const cell = document.createElement("div");
    cell.className = "cell";
    // 체커보드: (row+col) 홀수 칸만 대체 톤. 16(짝수) 폭이라
    // nth-child(even)은 세로줄이 되므로 좌표 패리티로 직접 계산한다.
    if ((row + col) % 2 === 1) cell.classList.add("cell--alt");
    cells.push(cell);
    frag.appendChild(cell);
  }
  grid.appendChild(frag);
}

// ---- 칠하기 (모델 + DOM 동시 갱신) ----
function paint(i, color) {
  if (i < 0 || i >= N) return;
  pixels[i] = color;
  // 색이면 인라인 배경으로 덮고, null이면 인라인만 제거 → 체커보드 복원.
  if (color) cells[i].style.backgroundColor = color;
  else cells[i].style.removeProperty("background-color");
}

function repaintAll() {
  for (let i = 0; i < N; i++) paint(i, pixels[i]);
}

// ---- undo ----
function pushUndo() {
  undoStack.push(pixels.slice());
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  undoBtn.disabled = false;
}

function undo() {
  const snap = undoStack.pop();
  if (!snap) return;
  for (let i = 0; i < N; i++) pixels[i] = snap[i];
  repaintAll();
  if (undoStack.length === 0) undoBtn.disabled = true;
}

// ---- 도구 / 색 선택 (양 컨트롤 그룹 동기화) ----
function setTool(next) {
  tool = next;
  penBtn.setAttribute("aria-pressed", String(next === "pen"));
  eraserBtn.setAttribute("aria-pressed", String(next === "eraser"));
}

function setColor(hex) {
  selectedColor = hex;
  // 색을 고르면 펜으로 자동 전환.
  setTool("pen");
  // 스워치 강조 동기화 (일치하는 고정색만 눌림 표시).
  for (const sw of swatchesEl.children) {
    sw.setAttribute(
      "aria-pressed",
      String(sw.dataset.color.toLowerCase() === hex.toLowerCase())
    );
  }
}

// ---- 팔레트 빌드 ----
function buildPalette() {
  const frag = document.createDocumentFragment();
  for (const hex of PALETTE) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.style.setProperty("--swatch", hex);
    b.dataset.color = hex;
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", `색상 ${hex}`);
    b.addEventListener("click", () => setColor(hex));
    frag.appendChild(b);
  }
  swatchesEl.appendChild(frag);
}

// ---- 좌표 → 셀 인덱스 (rect 수학 + clamp) ----
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function indexFromEvent(e) {
  const r = grid.getBoundingClientRect();
  const cellPx = r.width / GRID;
  // 약간의 가장자리 오버슈트는 clamp로 흡수(드래그 UX)하되,
  // 명백히 영역 밖(한 셀 이상)이면 -1을 반환해 paint를 건너뛴다.
  const m = cellPx;
  if (
    e.clientX < r.left - m ||
    e.clientX > r.right + m ||
    e.clientY < r.top - m ||
    e.clientY > r.bottom + m
  ) {
    return -1;
  }
  const col = clamp(Math.floor((e.clientX - r.left) / cellPx), 0, GRID - 1);
  const row = clamp(Math.floor((e.clientY - r.top) / cellPx), 0, GRID - 1);
  return row * GRID + col;
}

function applyAt(i) {
  if (i < 0) return; // 영역 밖이면 건너뜀 (lastI 유지)
  if (i === lastI) return; // 같은 셀 중복 페인트 생략
  lastI = i;
  paint(i, tool === "eraser" ? null : selectedColor);
}

// ---- 포인터 입력 (단일 경로) ----
function onPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return; // 좌클릭/터치만
  drawing = true;
  strokeBefore = pixels.slice(); // pre-stroke 스냅샷(스트로크 끝에 커밋)
  lastI = -1;
  grid.setPointerCapture(e.pointerId);
  applyAt(indexFromEvent(e)); // 한 번 탭도 즉시 한 칸 찍힘
}

function onPointerMove(e) {
  if (!drawing) return;
  e.preventDefault(); // touch-action:none 보강 (passive:false 필수)
  applyAt(indexFromEvent(e));
}

function endStroke() {
  if (!drawing) return;
  drawing = false;
  lastI = -1;
  // 스트로크로 실제 변화가 있었을 때만 pre-stroke 스냅샷 커밋.
  if (strokeBefore && changed(strokeBefore, pixels)) {
    undoStack.push(strokeBefore);
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    undoBtn.disabled = false;
  }
  strokeBefore = null;
}

function changed(a, b) {
  for (let i = 0; i < N; i++) if (a[i] !== b[i]) return true;
  return false;
}

// ---- Clear ----
function clearAll() {
  if (pixels.every((p) => p === null)) return; // 이미 비어있으면 무시
  if (!confirm("캔버스를 모두 지울까요? (되돌리기로 복구 가능)")) return;
  pushUndo(); // Clear 직전 상태 저장
  for (let i = 0; i < N; i++) paint(i, null);
}

// ---- PNG 저장 (별도 offscreen canvas, fillRect per cell) ----
function savePNG() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = GRID * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false; // 안티에일리어싱 배제
  for (let i = 0; i < N; i++) {
    const c = pixels[i];
    if (!c) continue; // 빈 칸은 건너뛰어 투명 유지
    const col = i % GRID;
    const row = (i / GRID) | 0;
    ctx.fillStyle = c;
    ctx.fillRect(col * SCALE, row * SCALE, SCALE, SCALE);
  }
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pixel-art.png";
    a.click();
    // 일부 브라우저는 click 이후 비동기로 다운로드를 시작하므로
    // 같은 태스크에서 해제하면 다운로드가 취소될 수 있다 → 다음 태스크로 미룬다.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, "image/png");
}

// ---- 테마 토글 (블로그와 동일 "theme" 키, 로직 자체 포함) ----
function syncThemePressed() {
  // 현재 다크 여부를 aria-pressed로 노출(스크린리더가 상태를 알 수 있게).
  const isDark =
    document.documentElement.getAttribute("data-theme") === "dark";
  themeToggle.setAttribute("aria-pressed", String(isDark));
}

function initTheme() {
  syncThemePressed();
  themeToggle.addEventListener("click", () => {
    const next =
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "light"
        : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // 프라이빗 모드 등 차단 환경에서도 토글 자체는 동작.
    }
    syncThemePressed();
  });
}

// ---- 배선 ----
function init() {
  buildGrid();
  buildPalette();
  setColor(selectedColor); // 초기 색 강조 + 펜 활성
  undoBtn.disabled = true;

  grid.addEventListener("pointerdown", onPointerDown);
  grid.addEventListener("pointermove", onPointerMove, { passive: false });
  grid.addEventListener("pointerup", endStroke);
  grid.addEventListener("pointercancel", endStroke);

  penBtn.addEventListener("click", () => setTool("pen"));
  eraserBtn.addEventListener("click", () => setTool("eraser"));
  undoBtn.addEventListener("click", undo);
  clearBtn.addEventListener("click", clearAll);
  saveBtn.addEventListener("click", savePNG);
  customColor.addEventListener("input", (e) => setColor(e.target.value));

  initTheme();
}

init();
