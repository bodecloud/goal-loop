export const DIFFICULTIES = {
  beginner: { rows: 9, cols: 9, mines: 10, label: "Beginner" },
  intermediate: { rows: 16, cols: 16, mines: 40, label: "Intermediate" },
  expert: { rows: 16, cols: 30, mines: 99, label: "Expert" }
};

export const CELL = {
  HIDDEN: "hidden",
  REVEALED: "revealed",
  FLAGGED: "flagged"
};

export const GAME_STATUS = {
  READY: "ready",
  PLAYING: "playing",
  WON: "won",
  LOST: "lost"
};

function key(row, col) {
  return `${row},${col}`;
}

function inBounds(rows, cols, row, col) {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

function neighbors(rows, cols, row, col) {
  const result = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) {
        continue;
      }
      const nr = row + dr;
      const nc = col + dc;
      if (inBounds(rows, cols, nr, nc)) {
        result.push([nr, nc]);
      }
    }
  }
  return result;
}

export function createGame(difficulty = "beginner", rng = Math.random) {
  const config = DIFFICULTIES[difficulty];
  if (!config) {
    throw new Error(`Unknown difficulty: ${difficulty}`);
  }

  const { rows, cols, mines } = config;
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      mine: false,
      adjacent: 0,
      state: CELL.HIDDEN
    }))
  );

  return {
    difficulty,
    rows,
    cols,
    mineCount: mines,
    cells,
    status: GAME_STATUS.READY,
    flagsPlaced: 0,
    revealedCount: 0,
    firstClick: true,
    startedAt: null,
    endedAt: null,
    rng
  };
}

export function placeMines(game, safeRow, safeCol) {
  const forbidden = new Set(neighbors(game.rows, game.cols, safeRow, safeCol).map(([r, c]) => key(r, c)));
  forbidden.add(key(safeRow, safeCol));

  const candidates = [];
  for (let row = 0; row < game.rows; row += 1) {
    for (let col = 0; col < game.cols; col += 1) {
      if (!forbidden.has(key(row, col))) {
        candidates.push([row, col]);
      }
    }
  }

  if (candidates.length < game.mineCount) {
    throw new Error("Not enough safe cells for mine placement");
  }

  shuffleInPlace(candidates, game.rng);
  for (let i = 0; i < game.mineCount; i += 1) {
    const [row, col] = candidates[i];
    game.cells[row][col].mine = true;
  }

  for (let row = 0; row < game.rows; row += 1) {
    for (let col = 0; col < game.cols; col += 1) {
      if (game.cells[row][col].mine) {
        continue;
      }
      game.cells[row][col].adjacent = neighbors(game.rows, game.cols, row, col).filter(
        ([nr, nc]) => game.cells[nr][nc].mine
      ).length;
    }
  }
}

function shuffleInPlace(array, rng) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function remainingMines(game) {
  return game.mineCount - game.flagsPlaced;
}

export function elapsedSeconds(game, now = Date.now()) {
  if (!game.startedAt) {
    return 0;
  }
  const end = game.endedAt ?? now;
  return Math.min(999, Math.floor((end - game.startedAt) / 1000));
}

function ensurePlaying(game) {
  if (game.status === GAME_STATUS.WON || game.status === GAME_STATUS.LOST) {
    return false;
  }
  if (game.status === GAME_STATUS.READY) {
    game.status = GAME_STATUS.PLAYING;
  }
  return true;
}

export function revealCell(game, row, col) {
  if (!inBounds(game.rows, game.cols, row, col)) {
    return { changed: false, hitMine: false };
  }

  const cell = game.cells[row][col];
  if (cell.state === CELL.REVEALED || cell.state === CELL.FLAGGED) {
    return { changed: false, hitMine: false };
  }

  if (game.firstClick) {
    placeMines(game, row, col);
    game.firstClick = false;
    game.startedAt = Date.now();
  }

  if (!ensurePlaying(game)) {
    return { changed: false, hitMine: false };
  }

  if (cell.mine) {
    cell.state = CELL.REVEALED;
    game.status = GAME_STATUS.LOST;
    game.endedAt = Date.now();
    revealAllMines(game);
    return { changed: true, hitMine: true };
  }

  floodReveal(game, row, col);
  checkWin(game);
  return { changed: true, hitMine: false };
}

function floodReveal(game, row, col) {
  const stack = [[row, col]];
  while (stack.length > 0) {
    const [r, c] = stack.pop();
    const cell = game.cells[r][c];
    if (cell.state !== CELL.HIDDEN) {
      continue;
    }
    cell.state = CELL.REVEALED;
    game.revealedCount += 1;
    if (cell.adjacent === 0) {
      for (const [nr, nc] of neighbors(game.rows, game.cols, r, c)) {
        if (game.cells[nr][nc].state === CELL.HIDDEN) {
          stack.push([nr, nc]);
        }
      }
    }
  }
}

function revealAllMines(game) {
  for (let row = 0; row < game.rows; row += 1) {
    for (let col = 0; col < game.cols; col += 1) {
      const cell = game.cells[row][col];
      if (cell.mine) {
        cell.state = CELL.REVEALED;
      }
    }
  }
}

function checkWin(game) {
  const safeCells = game.rows * game.cols - game.mineCount;
  if (game.revealedCount >= safeCells) {
    game.status = GAME_STATUS.WON;
    game.endedAt = Date.now();
    autoFlagRemainingMines(game);
  }
}

function autoFlagRemainingMines(game) {
  for (let row = 0; row < game.rows; row += 1) {
    for (let col = 0; col < game.cols; col += 1) {
      const cell = game.cells[row][col];
      if (cell.mine && cell.state === CELL.HIDDEN) {
        cell.state = CELL.FLAGGED;
        game.flagsPlaced += 1;
      }
    }
  }
}

export function toggleFlag(game, row, col) {
  if (!inBounds(game.rows, game.cols, row, col)) {
    return false;
  }
  if (game.status === GAME_STATUS.WON || game.status === GAME_STATUS.LOST) {
    return false;
  }

  const cell = game.cells[row][col];
  if (cell.state === CELL.REVEALED) {
    return false;
  }

  if (cell.state === CELL.HIDDEN) {
    cell.state = CELL.FLAGGED;
    game.flagsPlaced += 1;
    return true;
  }

  if (cell.state === CELL.FLAGGED) {
    cell.state = CELL.HIDDEN;
    game.flagsPlaced -= 1;
    return true;
  }

  return false;
}

export function chordReveal(game, row, col) {
  if (!inBounds(game.rows, game.cols, row, col)) {
    return { changed: false, hitMine: false };
  }

  const cell = game.cells[row][col];
  if (cell.state !== CELL.REVEALED || cell.adjacent === 0) {
    return { changed: false, hitMine: false };
  }

  const adjacent = neighbors(game.rows, game.cols, row, col);
  const flagged = adjacent.filter(([r, c]) => game.cells[r][c].state === CELL.FLAGGED);
  if (flagged.length !== cell.adjacent) {
    return { changed: false, hitMine: false };
  }

  let changed = false;
  let hitMine = false;
  for (const [r, c] of adjacent) {
    const neighbor = game.cells[r][c];
    if (neighbor.state === CELL.HIDDEN) {
      const result = revealCell(game, r, c);
      changed = changed || result.changed;
      hitMine = hitMine || result.hitMine;
    }
  }

  return { changed, hitMine };
}

export function newGame(difficulty, rng = Math.random) {
  return createGame(difficulty, rng);
}

export function getCell(game, row, col) {
  if (!inBounds(game.rows, game.cols, row, col)) {
    return null;
  }
  return game.cells[row][col];
}

export function serializePublicCell(cell) {
  return {
    state: cell.state,
    adjacent: cell.state === CELL.REVEALED ? cell.adjacent : null,
    mine: cell.state === CELL.REVEALED && cell.mine ? true : null
  };
}

export function serializeGame(game) {
  return {
    difficulty: game.difficulty,
    rows: game.rows,
    cols: game.cols,
    mineCount: game.mineCount,
    flagsPlaced: game.flagsPlaced,
    remainingMines: remainingMines(game),
    status: game.status,
    elapsedSeconds: elapsedSeconds(game),
    cells: game.cells.map((row, r) => row.map((cell, c) => serializePublicCell(cell)))
  };
}
