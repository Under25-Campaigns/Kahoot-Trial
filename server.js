import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: process.env.ALLOWED_ORIGIN || true }, pingInterval: 25000, pingTimeout: 20000, maxHttpBufferSize: 1e5 });
const PORT = Number(process.env.PORT || 3000);
const rooms = new Map(); // Single-process development store. Use Redis-backed room state for multi-node production.
const demoQuiz = [
  { prompt: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'], correct: 1 },
  { prompt: 'How many sides does a hexagon have?', options: ['Five', 'Six', 'Seven', 'Eight'], correct: 1 },
  { prompt: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correct: 3 }
];
const colors = ['#7057ff', '#ff7058', '#06a889', '#f2a900'];

app.use(express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, activeRooms: rooms.size, transport: 'socket.io' }));

function makeCode() {
  let code;
  do { code = String(randomInt(100000, 1000000)); } while (rooms.has(code));
  return code;
}
function publicRoom(room) {
  const leaders = [...room.players.values()].sort((a, b) => b.score - a.score).slice(0, 10).map(({ id, name, score, color }) => ({ id, name, score, color }));
  return { code: room.code, status: room.status, questionIndex: room.questionIndex, question: room.questionIndex >= 0 ? room.questions[room.questionIndex] : null,
    questionCount: room.questions.length, players: leaders,
    answerCount: room.answerCount || 0, totalPlayers: room.players.size, reveal: room.reveal || null, deadline: room.deadline || null };
}
function publish(room) { io.to(room.code).emit('room:update', publicRoom(room)); }
function error(socket, message) { socket.emit('app:error', message); }
function cleanName(value) { return String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 18); }
function stopTimer(room) { clearTimeout(room.timer); room.timer = null; }
function finishQuestion(room) {
  if (room.status !== 'question') return;
  stopTimer(room); room.status = 'reveal';
  const q = room.questions[room.questionIndex];
  room.reveal = { correct: q.correct, counts: q.options.map((_, i) => [...room.answers.values()].filter(a => a.choice === i).length) };
  publish(room);
}

io.on('connection', socket => {
  socket.on('host:create', ({ title } = {}) => {
    const code = makeCode();
    const room = { code, title: String(title || 'Quick Quiz').slice(0, 60), host: socket.id, status: 'lobby', questions: demoQuiz, questionIndex: -1, players: new Map(), answers: new Map() };
    rooms.set(code, room); socket.join(code); socket.data.role = 'host'; socket.data.code = code;
    socket.emit('host:created', { code, title: room.title }); socket.emit('room:update', publicRoom(room));
  });

  socket.on('player:join', ({ code, name } = {}) => {
    code = String(code || '').replace(/\D/g, '').slice(0, 6); name = cleanName(name);
    const room = rooms.get(code);
    if (!room) return error(socket, 'That room code was not found. Check it and try again.');
    if (room.status !== 'lobby') return error(socket, 'This game has already started.');
    if (!name) return error(socket, 'Choose a nickname to join.');
    if (room.players.size >= 2500) return error(socket, 'This room has reached its player limit.');
    if ([...room.players.values()].some(p => p.name.toLowerCase() === name.toLowerCase())) name = `${name.slice(0, 14)} ${randomInt(10, 100)}`;
    const player = { id: socket.id, name, score: 0, color: colors[room.players.size % colors.length] };
    room.players.set(socket.id, player); socket.join(code); socket.data.role = 'player'; socket.data.code = code;
    socket.emit('player:joined', { name, code }); socket.emit('room:update', publicRoom(room));
    io.to(room.host).emit('room:player-joined', { name, totalPlayers: room.players.size });
  });

  socket.on('host:start', ({ code } = {}) => {
    const room = rooms.get(String(code));
    if (!room || room.host !== socket.id || room.status !== 'lobby') return error(socket, 'This game cannot be started.');
    room.questionIndex = 0; room.status = 'question'; room.answers.clear(); room.answerCount = 0;
    room.deadline = Date.now() + 20000; room.timer = setTimeout(() => finishQuestion(room), 20000); publish(room);
  });

  socket.on('player:answer', ({ choice } = {}) => {
    const room = rooms.get(socket.data.code);
    if (!room || socket.data.role !== 'player' || room.status !== 'question' || room.answers.has(socket.id)) return;
    choice = Number(choice);
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;
    const elapsed = Math.max(0, Date.now() - (room.deadline - 20000));
    const correct = choice === room.questions[room.questionIndex].correct;
    const points = correct ? Math.max(500, Math.round(1000 * (1 - elapsed / 40000))) : 0;
    room.answers.set(socket.id, { choice, correct });
    const player = room.players.get(socket.id); if (player) player.score += points;
    room.answerCount = room.answers.size;
    io.to(room.host).emit('room:answer-count', room.answerCount);
    if (room.answerCount === room.players.size && room.players.size > 0) finishQuestion(room);
  });

  socket.on('host:next', ({ code } = {}) => {
    const room = rooms.get(String(code));
    if (!room || room.host !== socket.id || room.status !== 'reveal') return error(socket, 'Wait for the question results first.');
    if (room.questionIndex + 1 >= room.questions.length) { room.status = 'finished'; room.reveal = null; publish(room); return; }
    room.questionIndex++; room.status = 'question'; room.reveal = null; room.answers.clear(); room.answerCount = 0;
    room.deadline = Date.now() + 20000; room.timer = setTimeout(() => finishQuestion(room), 20000); publish(room);
  });

  socket.on('host:force-reveal', ({ code } = {}) => {
    const room = rooms.get(String(code));
    if (!room || room.host !== socket.id) return error(socket, 'Only the host can reveal answers.');
    finishQuestion(room);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(socket.data.code); if (!room) return;
    if (room.host === socket.id) { stopTimer(room); io.to(room.code).emit('room:closed'); rooms.delete(room.code); return; }
    if (room.players.delete(socket.id)) io.to(room.host).emit('room:player-count', room.players.size);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => console.log(`Quiz Night listening on http://localhost:${PORT}`));
