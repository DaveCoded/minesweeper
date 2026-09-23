const DEFAULT_ROW_COUNT = 16;
const DEFAULT_COLUMN_COUNT = 30;
const DEFAULT_MINE_COUNT = 99;

const MINE_STRING = "x";

let anyPressed = false;
let gameStarted = false;
let gameOver = false;
let hasWon = false;

let mineCount = DEFAULT_MINE_COUNT;

let numRows = DEFAULT_ROW_COUNT;
let numCols = DEFAULT_COLUMN_COUNT;

let safeCellsOpened = numRows * numCols - mineCount;

let timer;
let secondsElapsed = 0;

let gameBoardState;

const gridEl = document.querySelector(".grid");

gridEl.addEventListener("mousedown", function () {
  anyPressed = true;
});

// By listening for mouseup on the document, you can cancel a click by letting go off the grid
document.addEventListener("mouseup", function () {
  anyPressed = false;
});

const faceButton = document.querySelector(".face");
faceButton.addEventListener("click", restartGame);

const mineCellLocations = [];

function initGrid() {
  // create a div for each row
  // create a div for each column for each row
  const numRows = DEFAULT_ROW_COUNT;
  const numCols = DEFAULT_COLUMN_COUNT;

  for (let i = 0; i < numRows; i++) {
    // Create a row in the DOM grid
    const rowEl = document.createElement("div");
    rowEl.classList.add("row");

    for (let j = 0; j < numCols; j++) {
      const vectorId = `${i}_${j}`;

      mineCellLocations.push(vectorId);

      const cellEl = document.createElement("div");
      cellEl.classList.add("cell", "closed");
      cellEl.id = vectorId;

      cellEl.addEventListener("mousedown", cellMouseDown);
      cellEl.addEventListener("mouseup", cellMouseUp);
      cellEl.addEventListener("mouseenter", cellMouseEnter);
      cellEl.addEventListener("mouseleave", cellMouseLeave);
      cellEl.addEventListener("contextmenu", cellRightClick);

      rowEl.appendChild(cellEl);
    }

    gridEl.appendChild(rowEl);
  }
}

initGrid();
initGameState();
renderMineCount();

function cellMouseDown(ev) {
  if (gameOver) return;
  const [x, y] = getCoordsFromEl(ev.target);
  const [_, status] = gameBoardState[x][y];

  // If cell is flagged or opened, it can't be pressed
  if (status !== "closed") return;
  ev.target.classList.add("pressed");
}

function cellMouseUp(ev) {
  if (gameOver) return;
  if (!gameStarted) {
    timer = setInterval(() => {
      secondsElapsed++;
      renderTimer();
    }, 1000);

    gameStarted = true;
  }

  if (ev.ctrlKey) return;

  // If the cell is already opened and it's a number, check if it has that number of adjacent flags.
  // If so, check each unopened cell. Flagged mines stay flagged and closed. Unflagged mines explode.
  // Any other unopened cell gets opened and their number shown. Blanks cause floodfill as usual.
  // If there are too many or two few adjacent flags, return;
  const [x, y] = getCoordsFromEl(ev.target);
  const [value, status] = gameBoardState[x][y];

  if (status === "flagged") return;

  if (value === MINE_STRING) {
    gameOver = true;
    renderCell(x, y);
    showIncorrectFlags();
    revealRemainingMines();
    clearInterval(timer);
    renderFace();
  }

  if (status === "closed") {
    openCell(x, y);
    return;
  }

  let numAdjacentFlags = 0;

  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      if (rowOffset === 0 && colOffset === 0) continue;

      const neighbourRow = x + rowOffset;
      const neighbourCol = y + colOffset;

      const isInBounds =
        neighbourRow >= 0 &&
        neighbourRow < gameBoardState.length &&
        neighbourCol >= 0 &&
        neighbourCol < gameBoardState[neighbourRow].length;

      if (!isInBounds) continue;

      const [_, adjacentCellStatus] =
        gameBoardState[neighbourRow][neighbourCol];

      if (adjacentCellStatus === "flagged") {
        numAdjacentFlags++;
      }
    }
  }

  if (numAdjacentFlags === value) {
    revealAdjacentCells(x, y);
  }
}

function revealAdjacentCells(x, y) {
  for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
    for (let colOffset = -1; colOffset <= 1; colOffset++) {
      if (rowOffset === 0 && colOffset === 0) continue;

      const neighbourRow = x + rowOffset;
      const neighbourCol = y + colOffset;

      const isInBounds =
        neighbourRow >= 0 &&
        neighbourRow < gameBoardState.length &&
        neighbourCol >= 0 &&
        neighbourCol < gameBoardState[neighbourRow].length;

      if (!isInBounds) continue;

      const [value, status] = gameBoardState[neighbourRow][neighbourCol];

      if (value === MINE_STRING) {
        if (status === "flagged") {
          continue;
        }
        // todo: extract into gameOver function
        gameOver = true;
        renderCell(x, y);
        showIncorrectFlags();
        revealRemainingMines();
        clearInterval(timer);
        renderFace();
      }

      openCell(neighbourRow, neighbourCol);
    }
  }
}

function cellMouseEnter(ev) {
  if (!anyPressed) return;
  ev.target.classList.add("pressed");
}

function cellMouseLeave(ev) {
  if (!anyPressed) return;
  ev.target.classList.remove("pressed");
}

function cellRightClick(ev) {
  ev.preventDefault();
  if (gameOver) return;
  const [x, y] = getCoordsFromEl(ev.target);
  toggleFlag(x, y);
}

function openCell(startRow, startCol) {
  const stack = [[startRow, startCol]];

  while (stack.length > 0) {
    const [row, col] = stack.pop();
    const [value, status] = gameBoardState[row][col];

    // Also prevents flagged cells from being opened.
    if (status !== "closed") continue;

    gameBoardState[row][col][1] = "opened";
    renderCell(row, col);

    safeCellsOpened--;

    if (safeCellsOpened === 0) {
      gameOver = true;
      hasWon = true;
      clearInterval(timer);
      renderFace();
    }

    // Reveal numbers, but don't expand through them.
    if (value !== 0) continue;

    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        if (rowOffset === 0 && colOffset === 0) continue;

        const neighbourRow = row + rowOffset;
        const neighbourCol = col + colOffset;

        const isInBounds =
          neighbourRow >= 0 &&
          neighbourRow < gameBoardState.length &&
          neighbourCol >= 0 &&
          neighbourCol < gameBoardState[neighbourRow].length;

        if (isInBounds) {
          stack.push([neighbourRow, neighbourCol]);
        }
      }
    }
  }
}

/**
 * Takes an array and shuffles it, mutating in place.
 * Starting from the end, each element is swapped with a random choice of
 * all the previous elements, or with itself. Repeat until each has been swapped.
 */
function fisherYatesShuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const randIdx = Math.floor(Math.random() * (i + 1));

    const temp = array[i];
    array[i] = array[randIdx];
    array[randIdx] = temp;
  }
}

function renderCell(row, col) {
  const cell = gameBoardState[row][col];
  const el = document.getElementById(`${row}_${col}`);
  const [value, status] = cell;

  el.className = "cell";
  el.classList.add(status);

  if (status === "opened") {
    el.classList.add(
      value === 0
        ? "blank"
        : value === MINE_STRING
          ? "mine-red"
          : `number-${value}`,
    );
  }
}

function renderMineCount() {
  const mineCountEl = document.querySelector(".mine-count");
  renderDigits(mineCount, mineCountEl);

  // ? What happens if you flag more than the amount of available flags?
}

function renderTimer() {
  const timerEl = document.querySelector(".timer");
  renderDigits(secondsElapsed, timerEl);
}

function renderDigits(count, el) {
  // Only 3 digits available (timer won't go over 999)
  const normalisedCount = count > 999 ? 999 : count;
  const paddedString = String(normalisedCount).padStart(3, "0");
  const countChildren = el.querySelectorAll("& > div");

  for (let i = 0; i < paddedString.length; i++) {
    const char = paddedString[i];
    countChildren[i].classList = `d${char}`;
  }
}

function renderFace() {
  const el = document.querySelector(".face");
  if (hasWon) {
    el.classList.add("win");
  } else if (gameOver) {
    el.classList.add("lose");
  } else {
    el.classList = ["face"];
  }
}

/**
 *
 * @param {number} row row index of cell to toggle
 * @param {number} col column index of cell to toggle
 * @returns {undefined} just calls renderCell
 */
function toggleFlag(row, col) {
  const cell = gameBoardState[row][col];

  if (cell[1] === "opened") return;

  if (cell[1] === "flagged") {
    cell[1] = "closed";
    mineCount++;
  } else {
    cell[1] = "flagged";
    mineCount--;
  }

  renderCell(row, col);
  renderMineCount();
}

/**
 *
 * @param {HTMLElement} el - element representing a given cell (div) in the grid
 * @returns {[x: number,y: number]} [x, y] coordinate tuple for a given cell in the grid
 *
 * Finds the element's id, which is in the form of "3_12", for instance, where
 * 3 is the row index (so 4th row here) and 12 is the column index (13th column)
 */
function getCoordsFromEl(el) {
  return el.id.split("_").map(Number);
}

function initGameState() {
  const mineCellLocations = [];

  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      const vectorId = `${i}_${j}`;
      mineCellLocations.push(vectorId);
    }
  }

  // Work out where to put mines by shuffling all the cell locations,
  // and taking the first [MINE_COUNT] elements to be mines
  fisherYatesShuffle(mineCellLocations);
  mineCellLocations.splice(DEFAULT_MINE_COUNT);

  // Initialise game board state
  gameBoardState = [
    ...Array.from({ length: DEFAULT_ROW_COUNT }).map(() => {
      return Array.from({ length: DEFAULT_COLUMN_COUNT }).map(() => {
        return [null, "closed"];
      });
    }),
  ];

  mineCellLocations.forEach((cellVector) => {
    const [x, y] = cellVector.split("_");
    gameBoardState[x][y][0] = MINE_STRING;
  });

  // Walk the grid and mark the values for cells adjacent to mines
  for (let i = 0; i < gameBoardState.length; i++) {
    const col = gameBoardState[i];
    for (let j = 0; j < col.length; j++) {
      const [value] = col[j];
      if (value === MINE_STRING) continue;

      let adjacentMineCount = 0;

      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
          // Ignore the current cell in the middle
          if (rowOffset === 0 && colOffset === 0) continue;

          const neighbourRow = i + rowOffset;
          const neighbourCol = j + colOffset;

          const isInBounds =
            neighbourRow > -1 &&
            neighbourRow < gameBoardState.length &&
            neighbourCol > -1 &&
            neighbourCol < col.length;

          if (!isInBounds) continue;

          if (gameBoardState[neighbourRow][neighbourCol][0] === MINE_STRING) {
            adjacentMineCount++;
          }
        }
      }

      col[j][0] = adjacentMineCount;
    }
  }
}

function restartGame() {
  anyPressed = false;
  gameStarted = false;
  gameOver = false;
  hasWon = false;
  mineCount = DEFAULT_MINE_COUNT;
  clearInterval(timer);
  secondsElapsed = 0;
  safeCellsOpened = numRows * numCols - mineCount;

  renderFace();
  renderTimer();
  renderMineCount();
  initGameState();

  document.querySelectorAll(".cell").forEach((cell) => {
    const [row, col] = getCoordsFromEl(cell);
    renderCell(row, col);
  });
}

function showIncorrectFlags() {
  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      const [value, status] = gameBoardState[i][j];
      if (value !== MINE_STRING && status === "flagged") {
        const el = document.getElementById(`${i}_${j}`);
        el.classList.add("mine-wrong");
      }
    }
  }
}

function revealRemainingMines() {
  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      const [value, status] = gameBoardState[i][j];
      if (value === MINE_STRING && status === "closed") {
        const el = document.getElementById(`${i}_${j}`);
        el.classList.add("mine");
      }
    }
  }
}
