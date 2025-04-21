// Import modul yang diperlukan
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

// Setup server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve file statis dari folder saat ini
app.use(express.static(__dirname));

// Arahkan ke file index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Konstanta Game (sama dengan yang ada di game.js)
const PLAYER_RADIUS = 14;
const BALL_RADIUS = 6;
const GOAL_WIDTH = 12;
const GOAL_HEIGHT = 100;
const FRICTION = 0.98;
const BALL_FRICTION = 0.99;
const PLAYER_SPEED = 2;
const PLAYER_WALK_SPEED = PLAYER_SPEED / 1.5;
const PLAYER_RUN_SPEED = PLAYER_SPEED * 1.5;
const KICK_POWER = 8;
const PASS_POWER = 5;
const MAX_ENERGY = 100;
const ENERGY_DRAIN_RATE = 0.8;
const ENERGY_RECOVERY_RATE = 0.3;
const DRIBBLE_DISTANCE = PLAYER_RADIUS + BALL_RADIUS + 2;
const DRIBBLE_STRENGTH = 0.2;
const MAX_ULTIMATE_GAUGE = 100;
const ULTIMATE_GAIN_RATE = 0.2;
const ULTIMATE_KICK_MULTIPLIER = 2.0;

// Dimensi canvas
const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 600;

// Status game
let players = {};
let ball = {
  x: CANVAS_WIDTH / 2,
  y: CANVAS_HEIGHT / 2,
  radius: BALL_RADIUS,
  velocityX: 0,
  velocityY: 0,
};

let scoreTeam1 = 0;
let scoreTeam2 = 0;
let isBallOut = false;
let outMessageTimer = 0;
let goalMessageTimer = 0;
const OUT_MESSAGE_DURATION = 90;
const GOAL_MESSAGE_DURATION = 120;

// Definisi gol
const goals = [
  {
    x: 0,
    y: CANVAS_HEIGHT / 2 - GOAL_HEIGHT / 2,
    width: GOAL_WIDTH,
    height: GOAL_HEIGHT,
    team: 2,
  },
  {
    x: CANVAS_WIDTH - GOAL_WIDTH,
    y: CANVAS_HEIGHT / 2 - GOAL_HEIGHT / 2,
    width: GOAL_WIDTH,
    height: GOAL_HEIGHT,
    team: 1,
  },
];

// Counter untuk memberi ID unik pada pemain
let playerIdCounter = 0;
let gameStarted = false;
const MIN_PLAYERS_TO_START = 2;

// Handle koneksi socket
io.on("connection", (socket) => {
  console.log(`Pemain baru terhubung: ${socket.id}`);

  // Beri ID unik pada pemain baru
  const playerId = ++playerIdCounter;

  // Berikan ID ke client
  socket.emit("playerId", playerId);

  // Tentukan tim berdasarkan jumlah pemain (balancing)
  let teamNumber;
  const team1Count = Object.values(players).filter((p) => p.team === 1).length;
  const team2Count = Object.values(players).filter((p) => p.team === 2).length;

  if (team1Count <= team2Count) {
    teamNumber = 1;
  } else {
    teamNumber = 2;
  }

  // Beri tahu pemain tentang tim mereka
  socket.emit("teamAssignment", teamNumber);

  // Buat objek pemain baru dengan posisi awal yang berbeda berdasarkan tim
  const newPlayer = {
    id: playerId,
    x: teamNumber === 1 ? CANVAS_WIDTH / 4 : (CANVAS_WIDTH / 4) * 3,
    y: CANVAS_HEIGHT / 2,
    radius: PLAYER_RADIUS,
    velocityX: 0,
    velocityY: 0,
    isKicking: false,
    isRunning: false,
    isDribbling: false,
    isTackling: false,
    energy: MAX_ENERGY,
    ultimateGauge: 0,
    team: teamNumber,
    socket: socket.id,
    keys: {},
  };

  // Tambahkan pemain ke daftar pemain
  players[playerId] = newPlayer;

  // Cek jika game bisa dimulai
  checkGameStart();

  // Kirim state game ke pemain baru
  sendGameState();

  // Terima update state pemain dari client
  socket.on("playerState", (data) => {
    if (players[data.id]) {
      // Update posisi dan status pemain
      players[data.id].x = data.x;
      players[data.id].y = data.y;
      players[data.id].velocityX = data.velocityX;
      players[data.id].velocityY = data.velocityY;
      players[data.id].isKicking = data.isKicking;
      players[data.id].isRunning = data.isRunning;
      players[data.id].keys = data.keys;
    }
  });

  // Terima input pemain dari client
  socket.on("playerInput", (data) => {
    if (players[data.playerId]) {
      const player = players[data.playerId];

      // Lakukan aksi sesuai input
      switch (data.action) {
        case "kickBall":
          kickBall(player);
          break;
        case "toggleDribble":
          toggleDribble(player);
          break;
        case "passBall":
          passBall(player);
          break;
        case "releaseBall":
          releaseBall(player);
          break;
        case "tackleBall":
          tackleBall(player);
          break;
      }
    }
  });

  // Handle pemutusan koneksi
  socket.on("disconnect", () => {
    // Cari ID pemain yang terputus
    const disconnectedPlayerId = Object.keys(players).find(
      (id) => players[id].socket === socket.id
    );

    if (disconnectedPlayerId) {
      console.log(`Pemain ${disconnectedPlayerId} terputus`);
      delete players[disconnectedPlayerId];

      // Reset game jika semua pemain terputus
      if (Object.keys(players).length === 0) {
        resetGame();
      } else if (
        gameStarted &&
        Object.keys(players).length < MIN_PLAYERS_TO_START
      ) {
        // Hentikan game jika jumlah pemain kurang dari minimum
        gameStarted = false;
        io.emit("gameStarted", gameStarted);
      }
    }
  });
});

// Fungsi untuk mengecek apakah game bisa dimulai
function checkGameStart() {
  if (!gameStarted && Object.keys(players).length >= MIN_PLAYERS_TO_START) {
    console.log("Game dimulai!");
    gameStarted = true;
    io.emit("gameStarted", true);
    resetBall();
  }
}

// Fungsi untuk reset game
function resetGame() {
  scoreTeam1 = 0;
  scoreTeam2 = 0;
  resetBall();
  gameStarted = false;
}

// Fungsi untuk mengirim state game ke semua pemain
function sendGameState() {
  // Buat objek state game yang akan dikirim
  const gameState = {
    ball: {
      x: ball.x,
      y: ball.y,
      velocityX: ball.velocityX,
      velocityY: ball.velocityY,
    },
    players: {},
    score: {
      team1: scoreTeam1,
      team2: scoreTeam2,
    },
    outMessage: isBallOut,
    goalMessage: goalMessageTimer > 0,
  };

  // Hapus properti socket sebelum mengirim player data
  Object.keys(players).forEach((playerId) => {
    // Clone objek player tapi tanpa properti socket
    const { socket, ...playerWithoutSocket } = players[playerId];
    gameState.players[playerId] = playerWithoutSocket;
  });

  // Kirim state ke semua client
  io.emit("gameState", gameState);

  // Reset flag pesan
  isBallOut = false;
}

// Game loop server - update fisika dan logika game
function serverGameLoop() {
  if (gameStarted) {
    // Update fisika pemain
    updatePlayers();

    // Update posisi dan perilaku bola
    updateBallPosition();

    // Deteksi gol
    checkGoal();

    // Kurangi timer pesan
    if (outMessageTimer > 0) outMessageTimer--;
    if (goalMessageTimer > 0) goalMessageTimer--;
  }

  // Kirim state game terbaru ke semua client
  sendGameState();
}

// Update fisika semua pemain
function updatePlayers() {
  Object.values(players).forEach((player) => {
    // Kelola energi pemain
    const isMoving =
      player.keys &&
      (player.keys.w || player.keys.a || player.keys.s || player.keys.d);

    // Kurangi energi saat berlari
    if (player.isRunning && isMoving && player.energy > 0) {
      player.energy = Math.max(0, player.energy - ENERGY_DRAIN_RATE);
    } else if (!isMoving) {
      // Pulihkan energi saat tidak bergerak
      player.energy = Math.min(
        MAX_ENERGY,
        player.energy + ENERGY_RECOVERY_RATE
      );
    } else if (!player.isRunning) {
      // Pulihkan energi saat berjalan (tapi lebih lambat)
      player.energy = Math.min(
        MAX_ENERGY,
        player.energy + ENERGY_RECOVERY_RATE * 0.5
      );
    }

    // Isi ultimate gauge jika bergerak dalam mode dribbling
    if (player.isDribbling && isMoving) {
      player.ultimateGauge = Math.min(
        MAX_ULTIMATE_GAUGE,
        player.ultimateGauge + ULTIMATE_GAIN_RATE
      );
    }
  });
}

// Deteksi tabrakan antara dua lingkaran
function circleCollision(circle1, circle2) {
  const dx = circle1.x - circle2.x;
  const dy = circle1.y - circle2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < circle1.radius + circle2.radius;
}

// Tendang bola dari pemain tertentu
function kickBall(player) {
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance < player.radius + ball.radius + 5) {
    const angle = Math.atan2(dy, dx);
    let power = KICK_POWER;

    // Jika ultimate gauge penuh, tendangan lebih kuat
    if (player.ultimateGauge >= MAX_ULTIMATE_GAUGE) {
      power *= ULTIMATE_KICK_MULTIPLIER;
      player.ultimateGauge = 0; // Reset ultimate gauge setelah digunakan
    }

    ball.velocityX = Math.cos(angle) * power;
    ball.velocityY = Math.sin(angle) * power;

    // Jika sedang dribbling, hentikan
    if (player.isDribbling) {
      player.isDribbling = false;
    }
  }
}

// Toggle mode dribbling untuk pemain
function toggleDribble(player) {
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Periksa apakah ada pemain lain yang sedang melakukan dribble
  const otherDribblingPlayer = Object.values(players).find(
    (p) => p.isDribbling && p.id !== player.id
  );

  // Hanya bisa dribble jika dekat dengan bola dan tidak ada pemain lain yang sedang dribble
  if (distance < PLAYER_RADIUS + BALL_RADIUS * 3 && !otherDribblingPlayer) {
    player.isDribbling = !player.isDribbling;

    // Jika berhenti dribbling, beri sedikit dorongan ke bola
    if (!player.isDribbling) {
      releaseBall(player);
    }
  }
}

// Lepas bola dari dribbling
function releaseBall(player) {
  if (player.velocityX !== 0 || player.velocityY !== 0) {
    const speed = Math.sqrt(
      player.velocityX * player.velocityX + player.velocityY * player.velocityY
    );
    const dirX = player.velocityX / speed;
    const dirY = player.velocityY / speed;

    ball.velocityX = dirX * speed * 0.8;
    ball.velocityY = dirY * speed * 0.8;
  }
}

// Fungsi untuk melakukan operasi pass bola
function passBall(player) {
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Hanya bisa pass jika dekat dengan bola
  if (distance < player.radius + ball.radius + 10) {
    // Arah gerakan pemain atau arah default jika diam
    let moveAngle;

    if (player.velocityX !== 0 || player.velocityY !== 0) {
      // Jika pemain bergerak, arah pass mengikuti arah gerakan
      moveAngle = Math.atan2(player.velocityY, player.velocityX);
    } else {
      // Jika pemain diam, arah pass adalah arah bola saat ini dari pemain
      moveAngle = Math.atan2(dy, dx);
    }

    // Berhenti dribbling jika sedang dribbling
    if (player.isDribbling) {
      player.isDribbling = false;
    }

    // Terapkan kecepatan ke bola
    ball.velocityX = Math.cos(moveAngle) * PASS_POWER;
    ball.velocityY = Math.sin(moveAngle) * PASS_POWER;
  }
}

// Update posisi bola
function updateBallPosition() {
  // Cari pemain yang sedang dribbling
  const dribblingPlayer = Object.values(players).find(
    (player) => player.isDribbling
  );

  // Jika ada pemain yang sedang dribbling, bola mengikuti pemain
  if (dribblingPlayer) {
    // Tentukan posisi bola berdasarkan arah gerakan pemain
    if (dribblingPlayer.velocityX !== 0 || dribblingPlayer.velocityY !== 0) {
      // Jika pemain bergerak, bola berada di depan pemain berdasarkan arah gerakan
      const moveSpeed = Math.sqrt(
        dribblingPlayer.velocityX * dribblingPlayer.velocityX +
          dribblingPlayer.velocityY * dribblingPlayer.velocityY
      );
      const moveAngle = Math.atan2(
        dribblingPlayer.velocityY,
        dribblingPlayer.velocityX
      );

      // Bola berada sedikit di depan pemain dalam arah gerakan
      const targetX =
        dribblingPlayer.x + Math.cos(moveAngle) * DRIBBLE_DISTANCE;
      const targetY =
        dribblingPlayer.y + Math.sin(moveAngle) * DRIBBLE_DISTANCE;

      // Gerakan bola menuju posisi ideal dengan efek smoothing
      ball.velocityX =
        (targetX - ball.x) * (1 - DRIBBLE_STRENGTH) +
        dribblingPlayer.velocityX * 0.8;
      ball.velocityY =
        (targetY - ball.y) * (1 - DRIBBLE_STRENGTH) +
        dribblingPlayer.velocityY * 0.8;

      // Tambahkan sedikit variasi pada bola saat dribbling
      ball.velocityX += Math.random() * 0.2 - 0.1;
      ball.velocityY += Math.random() * 0.2 - 0.1;
    } else {
      // Jika pemain diam, bola tetap dekat dengan pemain
      const dx = ball.x - dribblingPlayer.x;
      const dy = ball.y - dribblingPlayer.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const dirX = dx / distance;
        const dirY = dy / distance;

        // Target posisi ideal untuk dribbling saat diam
        const targetX = dribblingPlayer.x + dirX * DRIBBLE_DISTANCE;
        const targetY = dribblingPlayer.y + dirY * DRIBBLE_DISTANCE;

        // Gerakan bola menuju posisi ideal
        ball.velocityX = (targetX - ball.x) * (1 - DRIBBLE_STRENGTH);
        ball.velocityY = (targetY - ball.y) * (1 - DRIBBLE_STRENGTH);
      }
    }
  } else {
    // Terapkan friction pada bola seperti biasa
    ball.velocityX *= BALL_FRICTION;
    ball.velocityY *= BALL_FRICTION;
  }

  // Update posisi bola
  ball.x += ball.velocityX;
  ball.y += ball.velocityY;

  // Deteksi jika bola keluar lapangan (out)
  if (
    ball.x - ball.radius < 0 ||
    ball.x + ball.radius > CANVAS_WIDTH ||
    ball.y - ball.radius < 0 ||
    ball.y + ball.radius > CANVAS_HEIGHT
  ) {
    // Periksa bahwa bola tidak di area gawang
    const isInGoalArea1 =
      ball.x - ball.radius < goals[0].x + goals[0].width &&
      ball.y > goals[0].y &&
      ball.y < goals[0].y + goals[0].height;

    const isInGoalArea2 =
      ball.x + ball.radius > goals[1].x &&
      ball.y > goals[1].y &&
      ball.y < goals[1].y + goals[1].height;

    if (!isInGoalArea1 && !isInGoalArea2) {
      // Bola keluar (OUT)
      isBallOut = true;
      outMessageTimer = OUT_MESSAGE_DURATION;

      // Matikan mode dribbling untuk semua pemain sebelum reset bola
      Object.values(players).forEach((player) => {
        player.isDribbling = false;
      });

      resetBall();
      return;
    }
  }

  // Deteksi tabrakan dengan pemain
  Object.values(players).forEach((player) => {
    if (circleCollision(player, ball)) {
      const dx = ball.x - player.x;
      const dy = ball.y - player.y;
      const angle = Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);
      const overlap = player.radius + ball.radius - distance;

      // Dorong bola keluar dari pemain
      ball.x += Math.cos(angle) * overlap;
      ball.y += Math.sin(angle) * overlap;

      // Transfer momentum
      const power = Math.sqrt(
        player.velocityX * player.velocityX +
          player.velocityY * player.velocityY
      );
      if (power > 0) {
        ball.velocityX = Math.cos(angle) * power * 0.8;
        ball.velocityY = Math.sin(angle) * power * 0.8;
      }
    }
  });
}

// Deteksi apakah terjadi gol
function checkGoal() {
  for (const goal of goals) {
    if (
      ball.x - ball.radius < goal.x + goal.width &&
      ball.x + ball.radius > goal.x &&
      ball.y > goal.y &&
      ball.y < goal.y + goal.height
    ) {
      // Gol terjadi, update skor
      if (goal.team === 1) {
        scoreTeam1++;
      } else {
        scoreTeam2++;
      }

      // Aktifkan pesan GOAL
      goalMessageTimer = GOAL_MESSAGE_DURATION;

      // Reset posisi bola
      resetBall();
      break;
    }
  }
}

// Reset posisi bola ke tengah
function resetBall() {
  // Matikan mode dribbling untuk semua pemain
  Object.values(players).forEach((player) => {
    player.isDribbling = false;
  });

  // Reset posisi bola
  ball.x = CANVAS_WIDTH / 2;
  ball.y = CANVAS_HEIGHT / 2;
  ball.velocityX = 0;
  ball.velocityY = 0;
}

// Fungsi untuk melakukan tackle
function tackleBall(player) {
  // Set status tackling
  player.isTackling = true;

  // Cari pemain yang sedang dribbling
  const dribblingPlayer = Object.values(players).find(
    (p) => p.isDribbling && p.id !== player.id
  );

  // Cek apakah ada pemain lain yang sedang dribbling
  if (dribblingPlayer) {
    // Cek jarak pemain dengan bola
    const dxBall = ball.x - player.x;
    const dyBall = ball.y - player.y;
    const distanceToBall = Math.sqrt(dxBall * dxBall + dyBall * dyBall);

    // Jika pemain menyentuh bola (jarak cukup dekat dengan bola)
    if (distanceToBall <= player.radius + ball.radius) {
      // Hentikan dribbling pemain tersebut
      dribblingPlayer.isDribbling = false;

      // Arahkan bola ke arah pemain yang melakukan tackle
      const angle = Math.atan2(dyBall, dxBall);
      ball.velocityX = -Math.cos(angle) * 3; // Bola terlempar ke arah berlawanan
      ball.velocityY = -Math.sin(angle) * 3;

      // Berikan sedikit energi untuk pemain yang berhasil tackle
      player.energy = Math.min(MAX_ENERGY, player.energy + 10);
    }
  }

  // Reset status tackling setelah 500ms
  setTimeout(() => {
    if (players[player.id]) {
      players[player.id].isTackling = false;
    }
  }, 500);
}

// Jalankan game loop server dengan interval 16ms (sekitar 60fps)
setInterval(serverGameLoop, 16);

// Mulai server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});
