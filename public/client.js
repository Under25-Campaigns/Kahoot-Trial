const socket = io();
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
let screen = 'home', role = null, code = '', pendingJoinCode = '', room = null;
let myName = '', myChoice = null, preserveAnswer = false, seconds = 20, countdown;
let draftQuiz = { title: 'My Quiz', questions: [{ prompt: '', options: ['', '', '', ''], correct: 0 }] };
let activeQuestion = 0;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notify(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove('show'), 3000); }
function setScreen(next) { screen = next; render(); }
function home() {
  localStorage.removeItem('quizNightHost'); localStorage.removeItem('quizNightPlayer');
  role = null; code = ''; pendingJoinCode = ''; room = null; setScreen('home');
}
function joinCodeForm() { pendingJoinCode = ''; setScreen('join-code'); }
function hostForm() { draftQuiz = { title: 'My Quiz', questions: [{ prompt: '', options: ['', '', '', ''], correct: 0 }] }; activeQuestion = 0; setScreen('host-form'); }
function continueWithCode() {
  const entered = document.querySelector('#room-code')?.value.replace(/\D/g, '').slice(0, 6) || '';
  if (entered.length !== 6) return notify('Enter the 6-digit room code.');
  socket.emit('room:check', { code: entered });
}
function readQuestion() {
  const prompt = document.querySelector('#question-prompt');
  if (!prompt) return;
  draftQuiz.title = document.querySelector('#quiz-title')?.value.trim() || 'My Quiz';
  const options = [...document.querySelectorAll('.answer-option')].map(el => el.value.trim());
  draftQuiz.questions[activeQuestion] = {
    prompt: prompt.value.trim(),
    options,
    correct: Number(document.querySelector('#correct-answer')?.value || 0)
  };
}
function selectQuestion(index) { readQuestion(); activeQuestion = index; render(); }
function addQuestion() {
  readQuestion();
  if (draftQuiz.questions.length >= 50) return notify('A quiz can have up to 50 questions.');
  draftQuiz.questions.push({ prompt: '', options: ['', '', '', ''], correct: 0 });
  activeQuestion = draftQuiz.questions.length - 1; render();
}
function removeQuestion() {
  if (draftQuiz.questions.length === 1) return notify('Keep at least one question in your quiz.');
  draftQuiz.questions.splice(activeQuestion, 1);
  activeQuestion = Math.max(0, activeQuestion - 1); render();
}
function startQuiz() {
  readQuestion();
  const invalid = draftQuiz.questions.findIndex(q => !q.prompt || q.options.length !== 4 || q.options.some(o => !o));
  if (invalid >= 0) { activeQuestion = invalid; render(); return notify(`Fill in the question and all four answers for question ${invalid + 1}.`); }
  role = 'host';
  socket.emit('host:create', { title: draftQuiz.title, questions: draftQuiz.questions });
}
function joinGame() {
  const name = document.querySelector('#nickname')?.value;
  if (!pendingJoinCode) return joinCodeForm();
  if (!name?.trim()) return notify('Add a nickname to join.');
  socket.emit('player:join', { code: pendingJoinCode, name });
}
function render() {
  if (screen === 'home') app.innerHTML = `<section class="hero"><div><div class="eyebrow">A little friendly competition</div><h1>Bring your<br>people. <em>Play.</em></h1><p class="intro">Big questions. Bigger energy. Start a quiz, share the room code, and see who takes the crown.</p><div class="buttons"><button class="btn btn-dark" onclick="hostForm()">Create a quiz <span aria-hidden="true">↗</span></button><button class="btn btn-light" onclick="joinCodeForm()">I have a code</button></div></div><div class="art" aria-hidden="true"><div class="blob"></div><div class="floating float-a">⚡ +850 points</div><div class="floating float-b">✦ 2,048 players joined</div><div class="quiz-card"><div class="card-top"><span>QUESTION 02 / 10</span><span class="pill">00:18</span></div><div class="card-title">What makes a great game?</div><div class="answer-row"><i>A</i> The people you play with</div><div class="answer-row"><i>B</i> A little bit of luck</div><div class="answer-row"><i>C</i> Asking good questions</div><div class="answer-row"><i>D</i> All of the above</div></div></div></section>`;
  else if (screen === 'join-code') app.innerHTML = `<section class="join-wrap"><form class="join-card" onsubmit="event.preventDefault(); continueWithCode()"><button type="button" class="back" onclick="home()">← Back</button><div class="eyebrow">Jump right in</div><h2>Join a game</h2><p>Enter the code from your host’s screen. No account or download needed.</p><label class="field-label" for="room-code">Room code</label><input class="field code-input" id="room-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"><button class="btn btn-dark wide">Continue →</button></form></section>`;
  else if (screen === 'join-name') app.innerHTML = `<section class="join-wrap"><form class="join-card" onsubmit="event.preventDefault(); joinGame()"><button type="button" class="back" onclick="joinCodeForm()">← Change room code</button><div class="eyebrow">Room ${esc(pendingJoinCode)}</div><h2>Pick a nickname</h2><p>This is the name other players will see in the game.</p><label class="field-label" for="nickname">Your nickname</label><input class="field" id="nickname" maxlength="18" placeholder="What should we call you?" autocomplete="nickname"><button class="btn btn-dark wide">Let’s play →</button></form></section>`;
  else if (screen === 'host-form') {
    const q = draftQuiz.questions[activeQuestion];
    const tabs = draftQuiz.questions.map((item, i) => `<button type="button" class="q-tab ${i === activeQuestion ? 'active' : ''}" onclick="selectQuestion(${i})">${i + 1}</button>`).join('');
    app.innerHTML = `<section class="join-wrap"><div class="builder-card"><button class="back" onclick="home()">← Back</button><div class="eyebrow">Build your game</div><h2>Make a quiz</h2><p>Write your questions and answers, then choose the correct answer.</p><label class="field-label" for="quiz-title">Quiz name</label><input class="field" id="quiz-title" maxlength="60" value="${esc(draftQuiz.title)}"><div class="builder-subhead"><span class="field-label">QUESTIONS (${draftQuiz.questions.length})</span><span>${activeQuestion + 1} / ${draftQuiz.questions.length}</span></div><div class="q-tabs">${tabs}<button class="q-add" type="button" onclick="addQuestion()" aria-label="Add question">+</button></div><label class="field-label" for="question-prompt">Question ${activeQuestion + 1}</label><textarea class="field field-textarea" id="question-prompt" maxlength="240" placeholder="Type your question">${esc(q.prompt)}</textarea><div class="answer-builder">${q.options.map((option, i) => `<label class="answer-edit"><span>${String.fromCharCode(65 + i)}</span><input class="field answer-option" maxlength="120" placeholder="Answer ${i + 1}" value="${esc(option)}"></label>`).join('')}</div><label class="field-label" for="correct-answer">Correct answer</label><select class="field correct-select" id="correct-answer">${q.options.map((_, i) => `<option value="${i}" ${q.correct === i ? 'selected' : ''}>${String.fromCharCode(65 + i)} is correct</option>`).join('')}</select><div class="builder-actions"><button type="button" class="btn btn-light" onclick="removeQuestion()">Remove question</button><button type="button" class="btn btn-dark" onclick="startQuiz()">Create room →</button></div><p class="builder-foot">${draftQuiz.questions.length} question${draftQuiz.questions.length === 1 ? '' : 's'} · 20 seconds per question</p></div></section>`;
  } else if (room) renderRoom();
}
function renderRoom() {
  const sorted = [...room.players].sort((a,b)=>b.score-a.score);
  const leaders = sorted.slice(0,5).map((p,i)=>`<div class="leader"><span><span class="rank">${i+1}.</span> <b>${esc(p.name)}</b></span><strong>${p.score}</strong></div>`).join('') || '<p class="subtle">Waiting for players…</p>';
  const chips = room.players.slice(-100).map(p=>`<span class="avatar-chip">${esc(p.name)}</span>`).join('');
  const head = `<div class="game-head"><div class="game-brand">✳ ${esc(room.title || 'QUIZ NIGHT')}</div><div class="room-code"><small>ROOM CODE</small><strong>${esc(room.code)}</strong></div></div>`;
  if (room.status === 'lobby') {
    app.innerHTML = `<section class="game-shell">${head}<div class="game-panel center"><span class="status-badge">● ROOM OPEN</span><h2>Game on the way.</h2><p class="subtle">Share this code with your players to fill the room.</p><div class="player-count">${room.totalPlayers}</div><div class="subtle">${room.totalPlayers===1?'player':'players'} joined</div><div class="avatars">${chips}</div>${role==='host'?`<button class="btn btn-dark" onclick="socket.emit('host:start',{code:'${esc(room.code)}'})">Start the quiz →</button>`:`<p class="subtle">You’re in, ${esc(myName)}! Hang tight for the host.</p>`}</div></section>`;
  } else if (room.status === 'question') {
    const q = room.question;
    const choices = q.options.map((o,i)=>`<button class="choice ${myChoice===i?'selected':''}" ${role==='host'||myChoice!==null?'disabled':''} onclick="answer(${i})">${esc(o)}</button>`).join('');
    app.innerHTML = `<section class="game-shell">${head}<div class="game-grid"><div class="game-panel"><div style="display:flex;align-items:center"><span class="question-kicker">QUESTION ${room.questionIndex+1} OF ${room.questionCount}</span><div class="timer">${seconds}</div></div><div class="question">${esc(q.prompt)}</div><div class="choices">${choices}</div>${role==='player'&&myChoice!==null?'<p class="subtle" style="margin:15px 0 0">Answer locked in ✓</p>':''}${role==='host'?`<div class="host-actions"><span class="answer-count">${room.answerCount} / ${room.totalPlayers} answered</span><button class="btn btn-light" onclick="socket.emit('host:force-reveal',{code:'${esc(room.code)}'})">Reveal answers</button></div>`:''}</div><aside><div class="side-box"><h3>🏆 TOP PLAYERS</h3>${leaders}</div><div class="side-box"><h3>IN THE ROOM</h3><strong style="font:700 25px 'Space Grotesk'">${room.totalPlayers.toLocaleString()}</strong><span class="subtle"> players</span></div></aside></div></section>`;
  } else if (room.status === 'reveal') {
    const correct = room.reveal?.correct;
    const opts = room.question.options.map((o,i)=>`<div class="leader-big" style="${i===correct?'background:#e8f8f3;border-radius:10px':''}"><span>${i===correct?'✓':'·'} ${esc(o)}</span><strong>${room.reveal.counts[i]}</strong></div>`).join('');
    const myCorrect = myChoice===correct;
    app.innerHTML = `<section class="game-shell">${head}<div class="game-grid"><div class="game-panel"><div class="question-kicker">QUESTION ${room.questionIndex+1} RESULTS</div><div class="question">${esc(room.question.prompt)}</div>${role==='player'?`<div class="result ${myCorrect?'ok':'no'}">${myChoice===null?'Time’s up!':myCorrect?'That’s right! Nice one.':'Not quite — keep going!'}</div>`:''}<div>${opts}</div>${role==='host'?`<div class="host-actions"><span class="answer-count">Leaderboard updated</span><button class="btn btn-dark" onclick="socket.emit('host:next',{code:'${esc(room.code)}'})">${room.questionIndex+1===room.questionCount?'See the winners':'Next question'} →</button></div>`:`<p class="subtle" style="margin-top:15px">Waiting for the host to continue…</p>`}</div><aside><div class="side-box"><h3>🏆 LEADERBOARD</h3>${leaders}</div></aside></div></section>`;
  } else if (room.status === 'finished') {
    app.innerHTML = `<section class="game-shell">${head}<div class="game-panel center"><div style="font-size:46px;margin:8px">🏆</div><div class="eyebrow" style="justify-content:center">THAT’S A WRAP</div><h2>Look at those champions.</h2><div class="leaderboard">${sorted.slice(0,10).map((p,i)=>`<div class="leader-big"><span>${['🥇','🥈','🥉'][i]||`${i+1}.`} ${esc(p.name)}</span><strong>${p.score.toLocaleString()} pts</strong></div>`).join('')}</div>${role==='host'?'<button class="btn btn-dark wide" onclick="home()">Back to home</button>':''}</div></section>`;
  }
}
function answer(choice) { if (myChoice!==null) return; myChoice=choice; socket.emit('player:answer',{choice}); render(); }
window.home=home; window.joinCodeForm=joinCodeForm; window.hostForm=hostForm; window.continueWithCode=continueWithCode; window.joinGame=joinGame;
window.selectQuestion=selectQuestion; window.addQuestion=addQuestion; window.removeQuestion=removeQuestion; window.startQuiz=startQuiz; window.answer=answer;

socket.on('connect', () => {
  try {
    const host = JSON.parse(localStorage.getItem('quizNightHost') || 'null');
    const player = JSON.parse(localStorage.getItem('quizNightPlayer') || 'null');
    if (host) socket.emit('host:resume', host);
    else if (player) socket.emit('player:resume', player);
  } catch { localStorage.removeItem('quizNightHost'); localStorage.removeItem('quizNightPlayer'); }
});
socket.on('host:created', data=>{ role='host'; code=data.code; localStorage.setItem('quizNightHost',JSON.stringify({code:data.code,token:data.token})); setScreen('room'); });
socket.on('host:resumed', data=>{ role='host'; code=data.code; setScreen('room'); });
socket.on('player:joined', data=>{
  role='player'; code=data.code; pendingJoinCode=data.code; myName=data.name; myChoice=data.answerChoice ?? null; preserveAnswer=myChoice!==null;
  localStorage.setItem('quizNightPlayer',JSON.stringify({code:data.code,playerId:data.playerId,token:data.token}));
  setScreen('room');
});
socket.on('room:check-result', data=>{ pendingJoinCode=data.code; setScreen('join-name'); });
socket.on('room:update', data=>{
  const changedQuestion=room?.questionIndex!==data.questionIndex;
  if(data.status==='question' && changedQuestion && !preserveAnswer) myChoice=null;
  preserveAnswer=false; room=data; code=data.code; screen=data.status;
  if(data.status==='question'){
    const deadline=data.deadline; seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000)); clearInterval(countdown);
    countdown=setInterval(()=>{seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));const timer=document.querySelector('.timer');if(timer)timer.textContent=seconds;},250);
  } else clearInterval(countdown);
  render();
});
socket.on('room:player-joined', data=>{if(!room)return;room.totalPlayers=data.totalPlayers;room.players.push({name:data.name,score:0});render();});
socket.on('room:player-count', count=>{if(room){room.totalPlayers=count;render();}});
socket.on('room:answer-count', count=>{if(room){room.answerCount=count;const target=document.querySelector('.answer-count');if(target)target.textContent=`${count} / ${room.totalPlayers} answered`;}});
socket.on('host:resume-denied',()=>{localStorage.removeItem('quizNightHost');role=null;room=null;setScreen('home');notify('That host session has expired.');});
socket.on('player:resume-denied',()=>{const old=JSON.parse(localStorage.getItem('quizNightPlayer')||'{}');pendingJoinCode=old.code||'';localStorage.removeItem('quizNightPlayer');role=null;room=null;setScreen('join-code');notify('That player session has expired. Please re-enter the room code.');});
socket.on('app:error', notify);
socket.on('room:closed',()=>{localStorage.removeItem('quizNightHost');localStorage.removeItem('quizNightPlayer');notify('The host ended this game.');home();});
socket.on('disconnect',()=>notify('Connection lost. Reconnecting…'));
render();
