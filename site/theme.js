const STORAGE_KEY = "goal-loop-theme";
const THEMES = new Set(["nt", "2000", "xp", "7"]);
const root = document.documentElement;
const select = document.getElementById("theme-select");

function applyTheme(theme) {
  if (!THEMES.has(theme)) {
    return;
  }

  root.dataset.theme = theme;
  if (select) {
    select.value = theme;
  }
}

const savedTheme = localStorage.getItem(STORAGE_KEY);
if (savedTheme) {
  applyTheme(savedTheme);
}

if (select) {
  select.addEventListener("change", (event) => {
    const theme = event.target.value;
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  });
}
