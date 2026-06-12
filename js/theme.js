// 다크 모드 토글.
// 페인트 전 초기 테마 설정은 각 HTML <head>의 인라인 스크립트가 담당하고(FOUC 방지),
// 이 모듈은 토글 버튼의 클릭 동작만 책임진다.

const STORAGE_KEY = "theme";

function currentTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage 차단 환경(프라이빗 모드 등)에서도 토글 자체는 동작하게 둔다.
  }
}

function syncPressed(button) {
  // 현재 다크 여부를 aria-pressed로 노출(스크린리더가 상태를 알 수 있게).
  button.setAttribute("aria-pressed", String(currentTheme() === "dark"));
}

export function initThemeToggle() {
  const button = document.querySelector(".theme-toggle");
  if (!button) return;

  syncPressed(button);
  button.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
    syncPressed(button);
  });
}

initThemeToggle();
