const word_length = 5;
const max_guesses = 5;
const STORAGE_KEY = "daily-word-state";

const words = [
  "prime",
  "abbey",
  "logic",
  "faith",
  "daddy",
  "eagle",
  "cabin",
  "early",
  "spazz",
  "pilot",
  "piano",
  "about",
  "apple",
  "seeds",
  "bagel",
  "stalk",
  "elder",
  "digit",
  "handy",
  "excel",
  "anvil",
  "coder",
  "ouija",
  "empty",
  "guess",
  "stink",
  "forum",
  "globe",
  "board"

];

/* ---------- per-day answer ---------- */
const answer = getTodaysWord().toUpperCase();

/* ---------- mutable game state ---------- */
let guesses = [];
let currentRow = 0;
let currentGuess = "";
let completed = false; 

/* ---------- cursor state ---------- */
let activeRow = 0;
let activeCol = 0;

/* ---------- board setup ---------- */
const board = document.getElementById("board");
initBoard(); // display the board

// Create a keyboard for the user to guess letters
function initKeyboard() {
  const layout = [
  ["Q","W","E","R","T","Y","U","I","O","P"],
  ["A","S","D","F","G","H","J","K","L"],
  ["ENTER","Z","X","C","V","B","N","M","⌫"]
];

  const kb = document.getElementById("keyboard");

  layout.forEach(row => {
    const rowDiv = document.createElement("div");
    rowDiv.className = "kbd-row d-flex justify-content-center mb-1";

    [...row].forEach(ch => {
      const key = document.createElement("button");
      key.type  = "button";
      key.className = "kbd-key btn btn-sm mx-1";   // use your own classes
      key.textContent = ch === "⌫" ? "⌫" : ch;     // show glyphs
      key.dataset.key = ch;                        // store the value

       /* —— extra class names for the two action keys —— */
      if (ch === "ENTER") {
        key.classList.add("enter-key");            // <— new class
      } else if (ch === "⌫") {
        key.classList.add("delete-key");           // <— new class
      }

      key.addEventListener("click", handleVirtualKey);
      rowDiv.appendChild(key);
    });

    kb.appendChild(rowDiv);
  });
}

function handleVirtualKey(e) {
  const key = e.currentTarget.dataset.key;

  if (key === "⌫")          deleteLetter();
  else if (key === "ENTER") submitGuess();
  else                       addLetter(key);
  
  /* keep focus rectangle on the board, not on the button */
  board.focus?.();          // optional: if you gave #board tabindex="0"
}

initKeyboard();
/* ---------- bring back yesterday’s progress ---------- */
loadState();              // <-- new line

/* Pick the same word for everyone on the same UTC day */
function getTodaysWord(){
  // 1. pick arbitrary “epoch” date; change if you like
  const epoch = new Date(2025, 0, 1);        // 1 Jan 2025 local time
  const now   = new Date();                  

  // 2. today at 00:00 local time
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // 3. how many days have passed since epoch?
  const daysSince = Math.floor((today - epoch) / 86_400_000); // 86 400 000 ms/day

  // 4. deterministic index
  const idx = daysSince % words.length;
  return words[idx];
}

/* -------------------------------------------------
   Game setup to load state from localStorage
   ------------------------------------------------- */
 function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ answer, guesses, currentGuess, completed })
  );
}

 function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  const { answer: savedAns,
          guesses: savedGuesses = [],
          currentGuess: cg = "",
          completed: wasCompleted = false } = JSON.parse(raw);

  if (savedAns !== answer) {
    localStorage.removeItem(STORAGE_KEY);   // new puzzle today
    return;
  }

   /* Reset globals exactly to what we read from storage */
  completed     = wasCompleted; 
  guesses      = [...savedGuesses];
  currentRow   = 0;               // we’ll advance it ourselves
  currentGuess = "";

  /* Re-draw finished rows WITHOUT re-pushing */
  savedGuesses.forEach(g => {
    currentGuess = g;
    colourRow(currentRow, g);     // helper shown below
    currentRow++;
  });
   
  /* if puzzle already finished, just show the board and bail out */
  if (completed) {
    return;
  }

  /* Otherwise, Re-draw half-typed row and focus it */
  currentGuess = cg;
  cg.split("").forEach((ch,i) => {
    board.children[currentRow].children[i].textContent = ch;
  });
   
  setFocus(currentRow, cg.length || 0);     // put cursor after last letter
 }


function colourRow(rowIdx, guess){
  const guessArr  = guess.split("");
  const answerArr = answer.split("");
  const freqCount = {};
  answerArr.forEach(ch => freqCount[ch] = (freqCount[ch]||0)+1);

  /* green pass */
  guessArr.forEach((ch,i) => {
    const tile = board.children[rowIdx].children[i];
    tile.textContent = ch;          // 1. restore the letter itself
    if (ch === answerArr[i]) {
      tile.classList.add("correct");
      colourKey(ch, "correct"); // shows correct letter in green on keyboard
      freqCount[ch]--;
      guessArr[i] = null;
    }
  });

  /* yellow / grey pass */
  guessArr.forEach((ch,i) => {
    if (ch===null) return;
    const tile = board.children[rowIdx].children[i];
    tile.textContent = ch;          // 2. shows the letter here as well
    if (freqCount[ch] > 0) {
      tile.classList.add("present");
      colourKey(ch, "present"); // shows correct letter in yellow on keyboard
      freqCount[ch]--;
    } else {
      tile.classList.add("absent");
      colourKey(ch, "absent"); // shows wrong letter in gray on keyboard
    }
  });
}

function colourKey(ch, className) {
  const keyBtn = document.querySelector(
    `.kbd-key[data-key="${ch}"]`
  );
  if (!keyBtn) return;

  /* Don’t downgrade a better colour to a worse one */
  const rank = { correct: 3, present: 2, absent: 1 };
  const current = [...keyBtn.classList].find(c => rank[c]);
  if (!current || rank[className] > rank[current]) {
    keyBtn.classList.remove("correct", "present", "absent");
    keyBtn.classList.add(className);
  }
}



/* -------------------------------------------------
   Touch vs. non-touch setup
   ------------------------------------------------- */


function handleTileClick(e){
  const tile   = e.currentTarget;
  const rowIdx = [...board.children].indexOf(tile.parentElement);
  const colIdx = [...tile.parentElement.children].indexOf(tile);

  /* allow clicks ONLY in the current row and on empty tiles */
  if (rowIdx === currentRow && !tile.textContent){
    setFocus(rowIdx, colIdx);
  }
}

function setFocus(r, c){
  /* remove old focus */
  board.querySelectorAll('.focused').forEach(t => t.classList.remove('focused'));

  activeRow = r;
  activeCol = c;
  board.children[activeRow].children[activeCol].classList.add('focused');
}

/* create a function to handle the keydown event */
function initBoard() {
  for (let r = 0; r < max_guesses; r++) {
    const row = document.createElement("div");
    row.className = "row mb-2 d-flex justify-content-center";
    for (let c = 0; c < word_length; c++) {
      row.appendChild(document.createElement("div")).className = "tile";
    }
    board.appendChild(row);
  }

  /* add listeners once the tiles exist */
  [...board.querySelectorAll(".tile")].forEach(t =>
    t.addEventListener("click", handleTileClick)
  );

  /* put the cursor on the very first tile */
  setFocus(0, 0);
}


function handleKey(e){
  const key = e.key.toUpperCase();
  if(key==="BACKSPACE") { deleteLetter(); return; }
  if(key==="ENTER")     { submitGuess(); return; }
  if(/^[A-Z]$/.test(key)){ addLetter(key); }
}

function addLetter(letter){
  if(currentGuess.length === word_length) return;         // row full

  /* put the letter in the active tile */
  const tile = board.children[activeRow].children[activeCol];
  tile.textContent = letter;
  currentGuess = replaceAt(currentGuess, activeCol, letter);
  saveState();

  /* advance cursor */
  if(activeCol < word_length-1){
    setFocus(activeRow, activeCol + 1);
  }
}

function deleteLetter(){
  /* when row is totally empty, nothing to do */
  if(!currentGuess.trim()) return;

  const tile = board.children[activeRow].children[activeCol];

  /* 1. If the current tile is empty, move left first */
  if(!tile.textContent && activeCol > 0){
    setFocus(activeRow, activeCol - 1);
  }

  /* 2. Now erase the letter at the (new) cursor position */
  const eraseTile = board.children[activeRow].children[activeCol];
  eraseTile.textContent = "";

  /* 3. update game state  currentGuess */
  currentGuess = replaceAt(currentGuess, activeCol, "");
  saveState();

}

/* ------------ helper, no padding ------------ */
function replaceAt(str,pos,ch){
  const arr = str.split("");
  arr[pos] = ch;
  return arr.join("");
}

function submitGuess(){
  if (currentGuess.length < word_length) return; 
     
  const played = currentGuess;        // keep a copy
  guesses.push(played);               // save finished word
  
  /* ---------- score & colour the *played* row ---------- */
  const guessArr  = played.split("");
  const answerArr = answer.split("");
  const freqCount = {};
  answerArr.forEach(ch => freqCount[ch] = (freqCount[ch] || 0)+1);

  /* 1. green pass */
  guessArr.forEach((ch,i)=>{
    const tile = board.children[currentRow].children[i];
    if(ch === answerArr[i]){
      tile.classList.add("correct");       // green now
      colourKey(ch, "correct"); // adds greencolor to key
      freqCount[ch]--;
      guessArr[i] = null;
    }
  });

  /* 2. yellow/grey pass */
  guessArr.forEach((ch,i)=>{
    if(ch===null) return;
    const tile = board.children[currentRow].children[i];
    if(freqCount[ch]>0){
      tile.classList.add("present");
      colourKey(ch, "present"); // adds yellow color to key
      freqCount[ch]--;
    }else{
      tile.classList.add("absent");
      colourKey(ch, "absent"); // adds grey color to key
    }
  });

  /* ---------- win / lose check using *played* ---------- */
  if (played === answer) {
  setTimeout(() => alert("Yea!! You got it! See you for tomorrow's game!"), 100);
    window.removeEventListener("keydown", handleKey);
    completed    = true;                       // mark solved
    currentGuess = "";          // make sure nothing is cached
  saveState();          // blank currentGuess is now in storage
  return;               // stop here – no need to advance row
}


  /* ---------- advance row or end game ---------- */
  currentRow++;
  currentGuess = "";
  saveState() // write clean state *after* clearing

  if (currentRow === max_guesses && played !== answer) {
    setTimeout(() => alert(`Bummer! Out of guesses!\nAnswer: ${answer}. See you for tomorrow's game!`), 100);
    completed = true;                           // mark finished
    saveState();
    return;
 }
   setFocus(currentRow, 0);          // ready for next guess
 }


/* refresh page at midnight */
function scheduleNextUtcMidnightRefresh () {
  const now = new Date();
  const msSinceUtcMidnight =
        now.getTime() - new Date(now.getFullYear(),
                                 now.getMonth(),
                                 now.getDate()).getTime();
  const msUntilNextUtcMidnight = 86_400_000 - msSincelocalMidnight;

  setTimeout(() => {
    localStorage.removeItem(STORAGE_KEY);   // forget yesterday’s state
    location.reload();                      // restart code → new answer
  }, msUntilNextLocalMidnight + 1_000);       // +1 s safety cushion
}

scheduleNextUtcMidnightRefresh();
