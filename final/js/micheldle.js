const word_length = 5;
const max_guesses = 5;
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

// const answer = words[Math.floor(Math.random() * words.length)].toUpperCase();
const answer = getTodaysWord().toUpperCase();
let currentRow = 0;
let currentGuess = "";

const board = document.getElementById("board");
initBoard(); // display the board

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


/* ---------- cursor state ---------- */
let activeRow = 0;
let activeCol = 0;

/* highlight the first tile initially */
setFocus(activeRow, activeCol);

/* attach one click listener for every tile created in initBoard() */
[...board.querySelectorAll('.tile')].forEach(tile =>
  tile.addEventListener('click', handleTileClick)
);

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
function initBoard(){
  [...board.children].forEach(row=>{
    for(let i=0;i<word_length;i++){
      row.appendChild(document.createElement("div")).className="tile";
    }
  });
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

  /* advance cursor */
  if(activeCol < word_length-1){
    setFocus(activeRow, activeCol + 1);
  }
}

function deleteLetter(){
  /* when row is totally empty → nothing to do */
  if(!currentGuess.trim()) return;

  const tile = board.children[activeRow].children[activeCol];

  /* 1️⃣ If the current tile is empty, move left first */
  if(!tile.textContent && activeCol > 0){
    setFocus(activeRow, activeCol - 1);
  }

  /* 2️⃣ Now erase the letter at the (new) cursor position */
  const eraseTile = board.children[activeRow].children[activeCol];
  eraseTile.textContent = "";

  /* wipe same spot in currentGuess */
  currentGuess = replaceAt(currentGuess, activeCol, "");

  /* 3️⃣ Finally, if we’re not at col 0, keep the cursor one step left
        (so repeated Backspaces keep deleting)                        */
  if(activeCol > 0){
    setFocus(activeRow, activeCol - 1);
  }
}

/* ------------ helper, no padding ------------ */
function replaceAt(str,pos,ch){
  const arr = str.split("");
  arr[pos] = ch;
  return arr.join("");
}

function submitGuess(){
  if(currentGuess.length < word_length) return;       

  /* -------- immediate win check -------- */
  if(currentGuess === answer){
    // paint entire row red
    [...board.children[currentRow].children].forEach(tile=>{
      tile.classList.add('win');           // new class
    });
    setTimeout(()=>alert("🎉 You got it!"),100);
    window.removeEventListener("keydown", handleKey);
    return;                                // no need for further scoring
  }

  /* ---- otherwise do normal green/yellow/grey scoring ---- */
  const guessArr  = currentGuess.split("");
  const answerArr = answer.split("");
  const freqCount = {};
  answerArr.forEach(ch => freqCount[ch] = (freqCount[ch]||0)+1);

  /* 1️⃣ green pass */
  guessArr.forEach((ch,i)=>{
    const tile = board.children[currentRow].children[i];
    if(ch === answerArr[i]){
      tile.classList.add("correct");       // green now
      freqCount[ch]--;
      guessArr[i] = null;
    }
  });

  /* 2️⃣ yellow/grey pass */
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

  /* advance to next row or fail after 5 guesses */
  if(++currentRow === max_guesses){
    setTimeout(()=>alert(`😢 Out of guesses!\nAnswer: ${answer}`),100);
  }else{
    currentGuess = "";
    setFocus(currentRow,0);                // put cursor at start of next row
  }
}

