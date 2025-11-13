import express from "express";
import http from "http";
import { Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const rooms = {};

io.on("connection", (socket) => {
  socket.on("createRoom", () => {
    const roomId = uuidv4().slice(0, 6);
    rooms[roomId] = { players: [], questions: [], started: false };
    socket.join(roomId);
    rooms[roomId].players.push({ id: socket.id, score: 0 });
    socket.emit("roomCreated", roomId);
  });

  socket.on("joinRoom", (roomId) => {
    const room = rooms[roomId];
    if (!room) return socket.emit("errorMsg", "Room not found");
    socket.join(roomId);
    room.players.push({ id: socket.id, score: 0 });
    io.to(roomId).emit("updatePlayers", room.players.length);
  });

  socket.on("startGame", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;
    room.started = true;
    const question = getQuestion();
    io.to(roomId).emit("newQuestion", question);
  });

  socket.on("answer", ({ roomId, correct }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player && correct) player.score++;
    io.to(roomId).emit("scores", room.players);
    const question = getQuestion();
    io.to(roomId).emit("newQuestion", question);
  });

  socket.on("disconnect", () => {
    for (const roomId in rooms) {
      const room = rooms[roomId];
      if (!room) continue;
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) delete rooms[roomId];
    }
  });
});

function getQuestion() {
  const questions = [
    { q: "What is the capital of France?", options: ["Paris", "London", "Rome"], correct: 0 },
    { q: "2 + 2 = ?", options: ["3", "4", "5"], correct: 1 },
    { q: "Which planet is known as the Red Planet?", options: ["Mars", "Earth", "Venus"], correct: 0 }
  ];
  return questions[Math.floor(Math.random() * questions.length)];
}

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log("Server running on port", PORT));
