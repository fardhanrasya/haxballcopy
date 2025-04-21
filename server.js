const WebSocket = require("ws");
const http = require("http");
const express = require("express");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Menggunakan direktori saat ini untuk file statis
app.use(express.static("./"));

// Objek untuk menyimpan semua koneksi client
const clients = {};
let clientId = 0;

// Menyimpan state game
const gameState = {
  ball: { x: 500, y: 300, velocityX: 0, velocityY: 0 },
  players: {},
  score: { team1: 0, team2: 0 },
};

// Handler koneksi WebSocket
wss.on("connection", (ws) => {
  // Tetapkan ID unik untuk setiap client
  const id = clientId++;
  const color = id % 2 === 0 ? "red" : "blue";
  const team = id % 2 === 0 ? 1 : 2;
  const x = team === 1 ? 250 : 750;

  // Buat objek player baru
  const player = {
    id,
    x,
    y: 300,
    team,
    color,
    velocityX: 0,
    velocityY: 0,
    isKicking: false,
    isRunning: false,
    isDribbling: false,
    ultimateGauge: 0,
  };

  // Tambahkan player ke game state
  gameState.players[id] = player;
  clients[id] = ws;

  console.log(`Client ${id} terhubung, tim: ${team}, warna: ${color}`);

  // Kirim ID player ke client
  ws.send(
    JSON.stringify({
      type: "init",
      id,
      gameState,
    })
  );

  // Broadcast ke semua player bahwa player baru telah bergabung
  broadcastGameState();

  // Handle pesan dari client
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === "playerUpdate") {
        // Update state player
        Object.assign(gameState.players[id], data.player);
      } else if (data.type === "ballUpdate") {
        // Update state bola jika client memiliki kendali
        Object.assign(gameState.ball, data.ball);
      } else if (data.type === "goal") {
        // Update skor jika terjadi gol
        if (data.team === 1) {
          gameState.score.team1++;
        } else {
          gameState.score.team2++;
        }
        // Reset posisi bola
        gameState.ball = { x: 500, y: 300, velocityX: 0, velocityY: 0 };
        broadcastGameState();
      }
    } catch (e) {
      console.error("Kesalahan memproses pesan:", e);
    }
  });

  // Handle pemutusan koneksi
  ws.on("close", () => {
    console.log(`Client ${id} terputus`);
    delete gameState.players[id];
    delete clients[id];
    broadcastGameState();
  });
});

// Fungsi untuk broadcast game state ke semua client
function broadcastGameState() {
  const message = JSON.stringify({
    type: "gameState",
    gameState,
  });

  Object.values(clients).forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast game state secara berkala
setInterval(broadcastGameState, 1000 / 30); // 30 fps

// Mulai server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
