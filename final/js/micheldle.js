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
  "empty"
];

/* ---------- per-day answer ---------- */
const answer = getTodaysWord().toUpperCase();

/* ---------- mutable game state ---------- */
let guesses = [];
let currentRow = 0;
let currentGuess = "";

/* ---------- cursor state ---------- */
let activeRow = 0;
let activeCol = 0;

/* ---------- board setup ---------- */
const board = document.getElementById("board");
initBoard(); // display the board
/* ---------- bring back yesterday’s progress ---------- */
loadState();              // <-- new line

/* Pick the same word for everyone on the same UTC day */
function getTodaysWord(){
  // 1. pick arbitrary “epoch” date; change if you like
  const epoch = new Date(Date.UTC(2025, 5, 10));        // 1 Jan 2025 00:00 UTC

  // 2. today at 00:00 UTC
  const now   = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  // 3. how many days have passed since epoch?
  const daysSince = Math.floor((todayUTC - epoch) / 86_400_000); // 86 400 000 ms/day

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
    JSON.stringify({ answer, guesses, currentGuess })
  );
}

 function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  const { answer: savedAns,
          guesses: savedGuesses = [],
          currentGuess: cg = "" } = JSON.parse(raw);

  if (savedAns !== answer) {
    localStorage.removeItem(STORAGE_KEY);   // new puzzle today
    return;
  }

  /* Reset globals exactly to what we read from storage */
  guesses      = [...savedGuesses];
  currentRow   = 0;               // we’ll advance it ourselves
  currentGuess = "";

  /* Re-draw finished rows WITHOUT re-pushing */
  savedGuesses.forEach(g => {
    currentGuess = g;
    colourRow(currentRow, g);     // helper shown below
    currentRow++;
  });

  /* Re-draw half-typed row */
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
      freqCount[ch]--;
    } else {
      tile.classList.add("absent");
    }
  });
}



// const answer = words[Math.floor(Math.random() * words.length)].toUpperCase();


/* -------------------------------------------------
   Touch vs. non-touch setup
   ------------------------------------------------- */
const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

if (isTouch){
  // ghostInput, and its listeners
  /* -------------------------------------------------
       off-screen input to trigger on-screen keyboard
   ------------------------------------------------- */

  const ghostInput = document.createElement('input');
  ghostInput.type  = 'text';
  ghostInput.autocomplete = 'off';
  ghostInput.autocorrect  = 'off';
  ghostInput.spellcheck   = false;
  ghostInput.inputMode    = 'text';   // iOS Safari hint
  ghostInput.maxLength    = 1;
  ghostInput.style.cssText = `
    position:fixed;
    bottom:0;
    left:0;
    width:1px; height:1px;
    opacity:0;
    z-index: -1;
  `;
  document.body.appendChild(ghostInput);
  ghostInput.focus();                 // open keyboard on load

  /* keep keyboard open whenever the player taps the board */
  board.addEventListener('click', () => ghostInput.focus());

  /* treat each character typed in the input like a hardware key */
  ghostInput.addEventListener('input', e => {
    const ch = e.target.value.toUpperCase();
    e.target.value = "";                    // clear for next press

    if(ch === '') return;                   // safety
    if(ch === '\n') { submitGuess(); return; }  // in case some kb sends Enter

    if(/^[A-Z]$/.test(ch))  addLetter(ch);
  });

  /* Backspace & Enter buttons on touch;
     simplest: listen for keydown events *inside* the input */
  ghostInput.addEventListener('keydown', e=>{
    if(e.key === 'Backspace') { deleteLetter(); e.preventDefault(); }
    if(e.key === 'Enter')     { submitGuess();  e.preventDefault(); }
  });

  } else {
    window.addEventListener('keydown', handleKey);   // desktop/laptop
  }


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
      freqCount[ch]--;
    }else{
      tile.classList.add("absent");
    }
  });

  /* ---------- win / lose check using *played* ---------- */
  if (played === answer) {
  setTimeout(() => alert("Yea!! You got it!"), 100);
    window.removeEventListener("keydown", handleKey);
    currentGuess = "";          // make sure nothing is cached
  saveState();          // blank currentGuess is now in storage
  return;               // stop here – no need to advance row
}


  /* ---------- advance row or end game ---------- */
  currentRow++;
  currentGuess = "";
  saveState() // write clean state *after* clearing

  if (currentRow === max_guesses && played !== answer) {
   setTimeout(() => alert(`Bummer! Out of guesses!\nAnswer: ${answer}`), 100);
 } else {
   setFocus(currentRow, 0);          // ready for next guess
 }
}

