import {
  DIFFICULTIES,
  GAME_STATUS,
  chordReveal,
  createGame,
  elapsedSeconds,
  newGame,
  remainingMines,
  revealCell,
  toggleFlag
} from "./src/game.js";

const mineCounterEl = document.getElementById("mine-counter");
const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");
const boardEl = document.getElementById("board");
const difficultyEl = document.getElementById("difficulty");
const newGameBtn = document.getElementById("new-game");
const faceBtn = document.getElementById("face");

let game = createGame("beginner");
let timerHandle = null;

function formatCounter(value) {
  const clamped = Math.max(-99, Math.min(999, value));
  const sign = clamped < 0 ? "-" : "";
  return `${sign}${String(Math.abs(clamped)).padStart(3, "0")}`;
}

function formatTimer(seconds) {
  return String(Math.min(999, seconds)).padStart(3, "0");
}

function updateHeader() {
  mineCounterEl.textContent = formatCounter(remainingMines(game));
  timerEl.textContent = formatTimer(elapsedSeconds(game));
  statusEl.textContent = game.status;
  faceBtn.textContent = game.status === GAME_STATUS.LOST ? "☹" : game.status === GAME_STATUS.WON ? "😎" : "🙂";
  faceBtn.classList.toggle("won", game.status === GAME_STATUS.WON);
  faceBtn.classList.toggle("lost", game.status === GAME_STATUS.LOST);
}

function cellClass(cell) {
  const classes = ["cell", cell.state];
  if (cell.state === "revealed") {
    classes.push(`n${cell.adjacent}`);
    if (cell.mine) {
      classes.push("mine");
    }
  }
  return classes.join(" ");
}

function cellLabel(cell) {
  if (cell.state === "flagged") {
    return "🚩";
  }
  if (cell.state !== "revealed") {
    return "";
  }
  if (cell.mine) {
    return "💣";
  }
  return cell.adjacent > 0 ? String(cell.adjacent) : "";
}

function renderBoard() {
  boardEl.style.gridTemplateColumns = `repeat(${game.cols}, 24px)`;
  boardEl.innerHTML = "";
  for (let row = 0; row < game.rows; row += 1) {
    for (let col = 0; col < game.cols; col += 1) {
      const cell = game.cells[row][col];
      const button = document.createElement("button");
      button.type = "button";
      button.className = cellClass(cell);
      button.textContent = cellLabel(cell);
      button.dataset.row = String(row);
      button.dataset.col = String(col);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        revealCell(game, row, col);
        renderBoard();
        updateHeader();
      });
      button.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleFlag(game, row, col);
        renderBoard();
        updateHeader();
      });
      button.addEventListener("dblclick", (event) => {
        event.preventDefault();
        chordReveal(game, row, col);
        renderBoard();
        updateHeader();
      });
      boardEl.appendChild(button);
    }
  }
}

function startTimer() {
  if (timerHandle) {
    clearInterval(timerHandle);
  }
  timerHandle = setInterval(() => {
    if (game.status === GAME_STATUS.PLAYING) {
      updateHeader();
    }
  }, 250);
}

function resetGame() {
  game = newGame(difficultyEl.value);
  renderBoard();
  updateHeader();
}

difficultyEl.innerHTML = Object.entries(DIFFICULTIES)
  .map(([key, value]) => `<option value="${key}">${value.label}</option>`)
  .join("");

newGameBtn.addEventListener("click", resetGame);
faceBtn.addEventListener("click", resetGame);
difficultyEl.addEventListener("change", resetGame);

renderBoard();
updateHeader();
startTimer();
