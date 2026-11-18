const socket = io();
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
let screen = 'home', role = null, code = '', room = null, myName = '', myChoice = null, seconds = 20, countdown;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notify(message) { toast.textContent = message; toast.classList.add('show'); clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove('show'), 3000); }
function setScreen(next) { screen = next; render(); }
function home() { role = null; code = ''; room = null; setScreen('home'); }
function joinForm() { setScreen('join'); }
function hostForm() { setScreen('host-form'); }
function hostGame() { role = 'host'; socket.emit('host:create', { title: 'Quick Quiz' }); }
function joinGame() {
  const roomCode = document.querySelector('#code')?.value || document.querySelector('#home-code')?.value;
  const name = document.querySelector('#nickname')?.value;
  if (!roomCode || roomCode.replace(/\D/g,'').length !== 6) return notify('Enter the 6-digit room code.');
  if (!name?.trim()) return notify('Add a nickname to join.');
  socket.emit('player:join', { code: roomCode, name });
}
function render() {
  if (screen === 'home') app.innerHTML = `<section class="hero"><div><div class="eyebrow">A little friendly competition</div><h1>Bring your<br>people. <em>Play.</em></h1><p class="intro">Big questions. Bigger energy. Start a quiz, share the room code, and see who takes the crown.</p><div class="buttons"><button class="btn btn-dark" onclick="hostForm()">Start a quiz <span aria-hidden="true">↗</span></button><button class="btn btn-light" onclick="joinForm()">I have a code</button></div><form class="quick-join" onsubmit="event.preventDefault(); joinForm(); const v=document.querySelector('#home-code').value; setTimeout(()=>{document.querySelector('#code').value=v},0)"><input id="home-code" inputmode="numeric" maxlength="6" placeholder="Enter a room code" aria-label="Room code"><button>Join game →</button></form></div><div class="art" aria-hidden="true"><div class="blob"></div><div class="floating float-a">⚡ +850 points</div><div class="floating float-b">✦ 2,048 players joined</div><div class="quiz-card"><div class="card-top"><span>QUESTION 02 / 10</span><span class="pill">00:18</span></div><div class="card-title">What makes a great game?</div><div class="answer-row"><i>A</i> The people you play with</div><div class="answer-row"><i>B</i> A little bit of luck</div><div class="answer-row"><i>C</i> Asking good questions</div><div class="answer-row"><i>D</i> All of the above</div></div></div></section>`;
  else if (screen === 'join') app.innerHTML = `<section class="join-wrap"><form class="join-card" onsubmit="event.preventDefault(); joinGame()"><button type="button" class="back" onclick="home()">← Back</button><div class="eyebrow">Jump right in</div><h2>Join a game</h2><p>Enter the code from your host’s screen. No account or download needed.</p><label class="field-label" for="code">Room code</label><input class="field code-input" id="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000"><label class="field-label" for="nickname">Your nickname</label><input class="field" id="nickname" maxlength="18" placeholder="What should we call you?" autocomplete="nickname"><button class="btn btn-dark wide">Let’s play <span>→</span></button></form></section>`;
  else if (screen === 'host-form') app.innerHTML = `<section class="join-wrap"><div class="join-card"><button class="back" onclick="home()">← Back</button><div class="eyebrow">You’re the host</div><h2>Ready to play?</h2><p>We’ve loaded a quick 3-question demo quiz. Start a room and share its code with everyone.</p><div class="side-box" style="background:#faf9f5"><h3>YOUR QUIZ</h3><strong>Quick Quiz: General Knowledge</strong><p style="margin:8px 0 0;font-size:12px">3 questions · 20 seconds each</p></div><button class="btn btn-dark wide" onclick="hostGame()">Create game room →</button></div></section>`;
  else if (room) renderRoom();
}
function renderRoom() {
  const sorted = [...room.players].sort((a,b)=>b.score-a.score);
  const leaders = sorted.slice(0,5).map((p,i)=>`<div class="leader"><span><span class="rank">${i+1}.</span> <b>${esc(p.name)}</b></span><strong>${p.score}</strong></div>`).join('') || '<p class="subtle">Waiting for players…</p>';
  const chips = room.players.slice(-100).map(p=>`<span class="avatar-chip">${esc(p.name)}</span>`).join('');
  const head = `<div class="game-head"><div class="game-brand">✳ QUIZ NIGHT</div><div class="room-code"><small>ROOM CODE</small><strong>${esc(room.code)}</strong></div></div>`;
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
window.home=home;window.joinForm=joinForm;window.hostForm=hostForm;window.hostGame=hostGame;window.joinGame=joinGame;window.answer=answer;
socket.on('host:created', data=>{ role='host'; code=data.code; setScreen('room'); });
socket.on('player:joined', data=>{ role='player'; code=data.code; myName=data.name; myChoice=null; setScreen('room'); });
socket.on('room:update', data=>{ const changedQuestion=room?.deadline!==data.deadline; room=data; code=data.code; if(data.status==='question' && (screen!=='question'||changedQuestion)) myChoice=null; screen=data.status; if(data.status==='question' && changedQuestion){clearInterval(countdown);const tick=()=>{seconds=Math.max(0,Math.ceil((data.deadline-Date.now())/1000));const timer=document.querySelector('.timer');if(timer)timer.textContent=seconds;};tick();countdown=setInterval(tick,250);} render(); });
socket.on('room:player-joined', data=>{if(!room)return;room.totalPlayers=data.totalPlayers;room.players.push({name:data.name,score:0});render();});
socket.on('room:player-count', count=>{if(room){room.totalPlayers=count;render();}});
socket.on('room:answer-count', count=>{if(room){room.answerCount=count;const target=document.querySelector('.answer-count');if(target)target.textContent=`${count} / ${room.totalPlayers} answered`;}});
socket.on('app:error', notify);
socket.on('room:closed',()=>{notify('The host ended this game.');home();});
socket.on('disconnect',()=>notify('Connection lost. Reconnecting…'));
render();
