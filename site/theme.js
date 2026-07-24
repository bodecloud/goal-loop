const STORAGE_KEY = "goal-loop-docs-theme";
const root = document.documentElement;
const toggle = document.getElementById("theme-toggle");

function preferredTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  root.dataset.theme = theme;
  if (toggle) {
    toggle.textContent = theme === "dark" ? "Light" : "Dark";
    toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }
}

applyTheme(preferredTheme());

if (toggle) {
  toggle.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  });
}

const tocLinks = [...document.querySelectorAll(".toc a")];
const sections = tocLinks
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

function setActiveLink() {
  const y = window.scrollY + 96;
  let current = sections[0];
  for (const section of sections) {
    if (section.offsetTop <= y) {
      current = section;
    }
  }
  for (const link of tocLinks) {
    const active = current && link.getAttribute("href") === `#${current.id}`;
    if (active) {
      link.setAttribute("aria-current", "true");
    } else {
      link.removeAttribute("aria-current");
    }
  }
}

window.addEventListener("scroll", setActiveLink, { passive: true });
setActiveLink();

for (const button of document.querySelectorAll(".copy-btn")) {
  button.addEventListener("click", async () => {
    const id = button.getAttribute("data-copy");
    const block = id ? document.getElementById(id) : null;
    if (!block) {
      return;
    }
    try {
      await navigator.clipboard.writeText(block.textContent);
      const previous = button.textContent;
      button.textContent = "Copied";
      setTimeout(() => {
        button.textContent = previous;
      }, 1200);
    } catch {
      button.textContent = "Failed";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 1200);
    }
  });
}
