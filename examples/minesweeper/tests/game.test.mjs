import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CELL,
  DIFFICULTIES,
  GAME_STATUS,
  chordReveal,
  createGame,
  elapsedSeconds,
  newGame,
  remainingMines,
  revealCell,
  serializeGame,
  toggleFlag
} from "../src/game.js";

function seededRng(sequence) {
  let index = 0;
  return () => {
    const value = sequence[index % sequence.length];
    index += 1;
    return value;
  };
}

function countMines(game) {
  let count = 0;
  for (let row = 0; row < game.rows; row += 1) {
    for (let col = 0; col < game.cols; col += 1) {
      if (game.cells[row][col].mine) {
        count += 1;
      }
    }
  }
  return count;
}

describe("difficulty presets", () => {
  it("defines beginner, intermediate, and expert boards", () => {
    assert.deepEqual(DIFFICULTIES.beginner, { rows: 9, cols: 9, mines: 10, label: "Beginner" });
    assert.deepEqual(DIFFICULTIES.intermediate, { rows: 16, cols: 16, mines: 40, label: "Intermediate" });
    assert.deepEqual(DIFFICULTIES.expert, { rows: 16, cols: 30, mines: 99, label: "Expert" });
  });
});

describe("board generation", () => {
  it("places the correct mine count after first click", () => {
    const game = createGame("beginner", seededRng([0.1, 0.2, 0.3, 0.4, 0.5]));
    revealCell(game, 0, 0);
    assert.equal(countMines(game), 10);
    assert.equal(game.cells[0][0].mine, false);
  });

  it("keeps first click safe", () => {
    const game = createGame("beginner", seededRng(Array.from({ length: 200 }, (_, i) => (i % 97) / 97)));
    revealCell(game, 4, 4);
    assert.equal(game.cells[4][4].mine, false);
    assert.equal(game.firstClick, false);
  });

  it("computes adjacent counts", () => {
    const game = createGame("beginner", () => 0.5);
    revealCell(game, 0, 0);
    for (let row = 0; row < game.rows; row += 1) {
      for (let col = 0; col < game.cols; col += 1) {
        const cell = game.cells[row][col];
        if (!cell.mine) {
          let expected = 0;
          for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
              if (dr === 0 && dc === 0) {
                continue;
              }
              const nr = row + dr;
              const nc = col + dc;
              if (nr >= 0 && nr < game.rows && nc >= 0 && nc < game.cols && game.cells[nr][nc].mine) {
                expected += 1;
              }
            }
          }
          assert.equal(cell.adjacent, expected);
        }
      }
    }
  });
});

describe("reveal and flood fill", () => {
  it("reveals a zero region recursively", () => {
    const game = createGame("beginner", () => 0.99);
    revealCell(game, 0, 0);
    const revealed = game.cells.flat().filter((cell) => cell.state === CELL.REVEALED).length;
    assert.ok(revealed > 1);
  });

  it("does not reveal flagged cells", () => {
    const game = createGame("beginner", () => 0.5);
    toggleFlag(game, 1, 1);
    revealCell(game, 0, 0);
    assert.equal(game.cells[1][1].state, CELL.FLAGGED);
  });
});

describe("flagging", () => {
  it("toggles flags and updates remaining mine counter", () => {
    const game = createGame("beginner");
    assert.equal(remainingMines(game), 10);
    toggleFlag(game, 0, 0);
    assert.equal(game.cells[0][0].state, CELL.FLAGGED);
    assert.equal(remainingMines(game), 9);
    toggleFlag(game, 0, 0);
    assert.equal(game.cells[0][0].state, CELL.HIDDEN);
    assert.equal(remainingMines(game), 10);
  });
});

describe("chord reveal", () => {
  it("reveals hidden neighbors when adjacent flags match number", () => {
    const game = createGame("beginner", () => 0.5);
    revealCell(game, 0, 0);
    const target = findChordTarget(game);
    assert.ok(target, "expected a numbered cell with hidden safe neighbors");
    const [row, col] = target;
    const neighbors = neighborCoords(game, row, col);
    for (const [r, c] of neighbors) {
      if (game.cells[r][c].mine) {
        toggleFlag(game, r, c);
      }
    }
    const hiddenBefore = neighbors.filter(([r, c]) => game.cells[r][c].state === CELL.HIDDEN).length;
    assert.ok(hiddenBefore > 0);
    const result = chordReveal(game, row, col);
    assert.equal(result.hitMine, false);
    assert.ok(result.changed);
    const hiddenAfter = neighbors.filter(([r, c]) => game.cells[r][c].state === CELL.HIDDEN).length;
    assert.equal(hiddenAfter, 0);
  });
});

describe("win and loss", () => {
  it("detects loss when revealing a mine", () => {
    const game = createGame("beginner", () => 0.01);
    revealCell(game, 0, 0);
    let mineCell = null;
    for (let row = 0; row < game.rows; row += 1) {
      for (let col = 0; col < game.cols; col += 1) {
        if (game.cells[row][col].mine && game.cells[row][col].state === CELL.HIDDEN) {
          mineCell = [row, col];
          break;
        }
      }
      if (mineCell) {
        break;
      }
    }
    assert.ok(mineCell);
    revealCell(game, mineCell[0], mineCell[1]);
    assert.equal(game.status, GAME_STATUS.LOST);
  });

  it("detects win when all safe cells are revealed", () => {
    const game = createGame("beginner", () => 0.5);
    revealCell(game, 0, 0);
    for (let row = 0; row < game.rows; row += 1) {
      for (let col = 0; col < game.cols; col += 1) {
        const cell = game.cells[row][col];
        if (!cell.mine && cell.state === CELL.HIDDEN) {
          revealCell(game, row, col);
        }
      }
    }
    assert.equal(game.status, GAME_STATUS.WON);
  });
});

describe("timer and reset", () => {
  it("starts timer on first reveal and caps at 999 seconds", () => {
    const game = createGame("beginner");
    revealCell(game, 0, 0);
    assert.ok(game.startedAt);
    game.startedAt = Date.now() - 2_000_000;
    assert.equal(elapsedSeconds(game), 999);
  });

  it("resets with newGame", () => {
    const first = createGame("intermediate");
    revealCell(first, 0, 0);
    toggleFlag(first, 1, 1);
    const second = newGame("expert");
    assert.equal(second.rows, 16);
    assert.equal(second.cols, 30);
    assert.equal(second.mineCount, 99);
    assert.equal(second.status, GAME_STATUS.READY);
    assert.equal(second.flagsPlaced, 0);
  });
});

describe("serialization", () => {
  it("hides mine data until revealed", () => {
    const game = createGame("beginner");
    const snapshot = serializeGame(game);
    assert.equal(snapshot.remainingMines, 10);
    assert.equal(snapshot.cells[0][0].mine, null);
  });
});

function neighborCoords(game, row, col) {
  const neighbors = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) {
        continue;
      }
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < game.rows && nc >= 0 && nc < game.cols) {
        neighbors.push([nr, nc]);
      }
    }
  }
  return neighbors;
}

function findChordTarget(game) {
  for (let row = 0; row < game.rows; row += 1) {
    for (let col = 0; col < game.cols; col += 1) {
      const cell = game.cells[row][col];
      if (cell.state !== CELL.REVEALED || cell.adjacent === 0) {
        continue;
      }
      const neighbors = neighborCoords(game, row, col);
      const hiddenSafe = neighbors.some(([r, c]) => !game.cells[r][c].mine && game.cells[r][c].state === CELL.HIDDEN);
      if (hiddenSafe) {
        return [row, col];
      }
    }
  }
  return null;
}
