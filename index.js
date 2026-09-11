const DEFAULT_ROW_COUNT = 16;
const DEFAULT_COLUMN_COUNT = 30;
const DEFAULT_MINE_COUNT = 99;

const MINE_STRING = "x";

let anyPressed = false;

const gridEl = document.querySelector(".grid");

gridEl.addEventListener("mousedown", function () {
  anyPressed = true;
});

// By listening for mouseup on the document, you can cancel a click by letting go off the grid
document.addEventListener("mouseup", function () {
  anyPressed = false;
});

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

// Work out where to put mines by shuffling all the cell locations,
// and taking the first [MINE_COUNT] elements to be mines
fisherYatesShuffle(mineCellLocations);
mineCellLocations.splice(DEFAULT_MINE_COUNT);

// Initialise game board state
const gameBoardState = [
  ...Array.from({ length: DEFAULT_ROW_COUNT }).map(() => {
    return Array.from({ length: DEFAULT_COLUMN_COUNT }).map(() => {
      return [null, "closed"];
    });
  }),
];

// Mark mine locations on board state
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

console.log({ gameBoardState });

// When a cell is opened, apply a class that sets a background image (empty, 1, 2, mine etc.)

function cellMouseDown(ev) {
  const [x, y] = getCoordsFromEl(ev.target);
  const [_, status] = gameBoardState[x][y];

  // If cell is flagged or opened, it can't be pressed
  if (status !== "closed") return;
  ev.target.classList.add("pressed");
}

function cellMouseUp(ev) {
  if (ev.ctrlKey) return;

  // If the cell is already opened and it's a number, check if it has that number of adjacent flags.
  // If so, check each unopened cell. Flagged mines stay flagged and closed. Unflagged mines explode.
  // Any other unopened cell gets opened and their number shown. Blanks cause floodfill as usual.
  // If there are too many or two few adjacent flags, return;
  const [x, y] = getCoordsFromEl(ev.target);
  const [_, status] = gameBoardState[x][y];

  if (status === "flagged") return;

  if (status === "closed") {
    openCell(ev.target);
    return;
  }

  // When cell is open, check if user has flagged all the mines around and open adjacent cells if so.
  let numAdjacentFlags = 0;
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
  const [x, y] = getCoordsFromEl(ev.target);
  toggleFlag(x, y);
}

function openCell(startEl) {
  const [startRow, startCol] = getCoordsFromEl(startEl);
  const stack = [[startRow, startCol]];

  while (stack.length > 0) {
    const [row, col] = stack.pop();
    const [value, status] = gameBoardState[row][col];

    // Also prevents flagged cells from being opened.
    if (status !== "closed") continue;

    gameBoardState[row][col][1] = "opened";
    renderCell(row, col);

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
  for (let i = array.length - 1; i >= 0; i--) {
    const randIdx = Math.floor(Math.random() * i + 1);

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

/**
 *
 * @param {number} row row index of cell to toggle
 * @param {number} col column index of cell to toggle
 * @returns {undefined} just calls renderCell
 */
function toggleFlag(row, col) {
  const cell = gameBoardState[row][col];

  if (cell[1] === "opened") return;

  cell[1] = cell[1] === "flagged" ? "closed" : "flagged";
  renderCell(row, col);
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
