import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

// Setup paths for static serving
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

// ✅ Serve index.html when user visits root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// --- Trivia Game Logic ---
let rooms = {};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("createRoom", (roomCode) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: {},
        questions: [],
        currentQuestion: 0,
      };
    }
    rooms[roomCode].players[socket.id] = { score: 0 };
    socket.join(roomCode);
    io.to(roomCode).emit("roomUpdate", Object.keys(rooms[roomCode].players).length);
  });

  socket.on("joinRoom", (roomCode) => {
    if (rooms[roomCode]) {
      rooms[roomCode].players[socket.id] = { score: 0 };
      socket.join(roomCode);
      io.to(roomCode).emit("roomUpdate", Object.keys(rooms[roomCode].players).length);
    } else {
      socket.emit("errorMsg", "Room not found");
    }
  });

  socket.on("startGame", (roomCode) => {
    if (!rooms[roomCode]) return;
    const questions = [
      { q: "Capital of France?", a: "Paris", opts: ["Paris", "Rome", "Madrid", "Berlin"] },
      { q: "2 + 2 = ?", a: "4", opts: ["3", "4", "5", "22"] },
      { q: "Color of the sky?", a: "Blue", opts: ["Blue", "Green", "Red", "Purple"] },
    ];
    rooms[roomCode].questions = questions;
    io.to(roomCode).emit("newQuestion", questions[0]);
  });

  socket.on("answer", ({ roomCode, answer }) => {
    const room = rooms[roomCode];
    if (!room) return;
    const question = room.questions[room.currentQuestion];
    if (answer === question.a) {
      room.players[socket.id].score += 1;
    }
    room.currentQuestion++;
    if (room.currentQuestion < room.questions.length) {
      io.to(roomCode).emit("newQuestion", room.questions[room.currentQuestion]);
    } else {
      io.to(roomCode).emit("gameOver", room.players);
    }
  });

  socket.on("disconnect", () => {
    for (const code in rooms) {
      if (rooms[code].players[socket.id]) {
        delete rooms[code].players[socket.id];
        io.to(code).emit("roomUpdate", Object.keys(rooms[code].players).length);
        if (Object.keys(rooms[code].players).length === 0) {
          delete rooms[code];
        }
      }
    }
  });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
