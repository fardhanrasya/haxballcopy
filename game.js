// Pengaturan Canvas
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1000;
canvas.height = 600;

// Konfigurasi Multiplayer
const socket = io(); // Perlu menyertakan socket.io-client
let playerId; // ID pemain ini
let players = {}; // Semua pemain yang terhubung
let gameStarted = false;

// Skor
let scoreTeam1 = 0;
let scoreTeam2 = 0;

// Konstanta Game
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
const PASS_POWER = 5; // Kekuatan pass lebih lemah dari tendangan tapi lebih presisi
const MAX_ENERGY = 100;
const ENERGY_DRAIN_RATE = 0.8;
const ENERGY_RECOVERY_RATE = 0.3;
const DRIBBLE_DISTANCE = PLAYER_RADIUS + BALL_RADIUS + 2;
const DRIBBLE_STRENGTH = 0.2;
const MAX_ULTIMATE_GAUGE = 100;
const ULTIMATE_GAIN_RATE = 0.2;
const ULTIMATE_KICK_MULTIPLIER = 2.0;

// Batas area pertandingan (lapangan dalam)
const FIELD_MARGIN = 50; // Jarak dari tepi canvas ke batas lapangan
const fieldBounds = {
  left: FIELD_MARGIN,
  right: canvas.width - FIELD_MARGIN,
  top: FIELD_MARGIN,
  bottom: canvas.height - FIELD_MARGIN,
};

// Status bola
let isBallOut = false;
let outMessageTimer = 0;
const OUT_MESSAGE_DURATION = 90; // Durasi tampilan pesan OUT dalam frame (sekitar 1.5 detik pada 60fps)

// Status gol
let goalMessageTimer = 0;
const GOAL_MESSAGE_DURATION = 120; // Durasi tampilan pesan GOAL dalam frame (sekitar 2 detik pada 60fps)

// Objek Game - sekarang hanya client representation
const player = {
  x: canvas.width / 4,
  y: canvas.height / 2,
  radius: PLAYER_RADIUS,
  color: "red",
  speed: PLAYER_WALK_SPEED, // Default speed adalah berjalan
  velocityX: 0,
  velocityY: 0,
  isKicking: false,
  isRunning: false,
  isDribbling: false, // Status dribbling
  isTackling: false, // Status tackling
  energy: MAX_ENERGY, // Energi awal maksimal
  ultimateGauge: 0, // Ultimate gauge dimulai dari 0
  team: 1, // Default team
};

const ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: BALL_RADIUS,
  color: "white",
  velocityX: 0,
  velocityY: 0,
};

const goals = [
  {
    x: 0,
    y: canvas.height / 2 - GOAL_HEIGHT / 2,
    width: GOAL_WIDTH,
    height: GOAL_HEIGHT,
    team: 2,
  },
  {
    x: canvas.width - GOAL_WIDTH,
    y: canvas.height / 2 - GOAL_HEIGHT / 2,
    width: GOAL_WIDTH,
    height: GOAL_HEIGHT,
    team: 1,
  },
];

// Input handling
const keys = {};
window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;

  // Toggle mode berlari ketika tombol L ditekan
  if (e.key.toLowerCase() === "l") {
    player.isRunning = true;

    // Lepaskan dribbling saat berlari
    if (player.isDribbling) {
      player.isDribbling = false;
      sendInput("releaseBall");
    }
  }

  // Toggle mode dribbling dengan tombol K
  if (e.key.toLowerCase() === "k") {
    sendInput("toggleDribble");
  }

  // Melakukan pass dengan tombol J
  if (e.key.toLowerCase() === "j") {
    sendInput("passBall");
  }

  // Melakukan tackle dengan tombol H
  if (e.key.toLowerCase() === "h") {
    sendInput("tackleBall");
  }

  // Memulai tendangan dengan spasi
  if (e.key === " " && !player.isKicking) {
    // Jika sedang dribbling, hentikan dribbling terlebih dahulu
    if (player.isDribbling) {
      player.isDribbling = false;
    }
    // Tendang bola
    sendInput("kickBall");
    player.isKicking = true;
  }

  // Kirim update status ke server setiap kali input berubah
  sendPlayerState();
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
  // Reset kicking state ketika spasi dilepas
  if (e.key === " ") {
    player.isKicking = false;
  }

  // Matikan mode berlari ketika tombol L dilepas
  if (e.key.toLowerCase() === "l") {
    player.isRunning = false;
  }

  // Kirim update status ke server setiap kali input berubah
  sendPlayerState();
});

// ============== NETWORKING CODE ==============

// Fungsi untuk mengirim input ke server
function sendInput(action) {
  socket.emit("playerInput", {
    action: action,
    playerId: playerId,
  });
}

// Fungsi untuk mengirim state pemain ke server
function sendPlayerState() {
  if (!playerId) return;

  socket.emit("playerState", {
    id: playerId,
    x: player.x,
    y: player.y,
    velocityX: player.velocityX,
    velocityY: player.velocityY,
    isKicking: player.isKicking,
    isRunning: player.isRunning,
    isDribbling: player.isDribbling,
    energy: player.energy,
    ultimateGauge: player.ultimateGauge,
    team: player.team,
    isTackling: player.isTackling,
    keys: keys, // Kirim status tombol untuk prediksi di server
  });
}

// Event listeners untuk socket
socket.on("connect", () => {
  console.log("Connected to server!");
});

socket.on("playerId", (id) => {
  playerId = id;
  console.log(`Player assigned ID: ${playerId}`);
});

socket.on("teamAssignment", (teamNumber) => {
  player.team = teamNumber;
  player.color = teamNumber === 1 ? "red" : "blue";
  console.log(`Assigned to team ${teamNumber}`);
});

socket.on("gameState", (gameState) => {
  // Update game state berdasarkan data dari server
  ball.x = gameState.ball.x;
  ball.y = gameState.ball.y;
  ball.velocityX = gameState.ball.velocityX;
  ball.velocityY = gameState.ball.velocityY;

  players = gameState.players;

  // Update score
  scoreTeam1 = gameState.score.team1;
  scoreTeam2 = gameState.score.team2;

  // Update tampilan skor di UI
  document.getElementById("team1").textContent = scoreTeam1;
  document.getElementById("team2").textContent = scoreTeam2;

  // Update pesan-pesan
  if (gameState.outMessage) {
    isBallOut = true;
    outMessageTimer = OUT_MESSAGE_DURATION;
  }

  if (gameState.goalMessage) {
    goalMessageTimer = GOAL_MESSAGE_DURATION;
  }

  // Update local player data jika ada
  if (players[playerId]) {
    // Hanya update status yang perlu sinkronisasi dari server (tidak termasuk input lokal)
    player.isDribbling = players[playerId].isDribbling;
    player.ultimateGauge = players[playerId].ultimateGauge;
    player.energy = players[playerId].energy;
    player.isTackling = players[playerId].isTackling;
  }
});

socket.on("gameStarted", () => {
  gameStarted = true;
  console.log("Game dimulai!");
});

// Deteksi tabrakan antara dua lingkaran (digunakan untuk rendering client-side)
function circleCollision(circle1, circle2) {
  const dx = circle1.x - circle2.x;
  const dy = circle1.y - circle2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < circle1.radius + circle2.radius;
}

// Update posisi pemain berdasarkan input
function updatePlayerPosition() {
  // Reset velocity
  player.velocityX = 0;
  player.velocityY = 0;

  // Deteksi apakah pemain sedang bergerak dengan WASD
  const isMoving = keys["w"] || keys["a"] || keys["s"] || keys["d"];

  // Update velocity berdasarkan input
  if (keys["w"]) player.velocityY = -player.speed;
  if (keys["s"]) player.velocityY = player.speed;
  if (keys["a"]) player.velocityX = -player.speed;
  if (keys["d"]) player.velocityX = player.speed;

  // Set kecepatan dan kelola energi
  if (player.isRunning && isMoving && player.energy > 0) {
    // Mode berlari saat bergerak
    player.speed = PLAYER_RUN_SPEED;
  } else {
    // Mode berjalan atau tidak bergerak
    player.speed = PLAYER_WALK_SPEED;
    // Jika energi habis, matikan mode berlari
    if (player.energy <= 0) {
      player.isRunning = false;
    }
  }

  // Update posisi
  player.x += player.velocityX;
  player.y += player.velocityY;

  // Batasan agar player tetap di dalam canvas
  if (player.x - player.radius < 0) player.x = player.radius;
  if (player.x + player.radius > canvas.width)
    player.x = canvas.width - player.radius;
  if (player.y - player.radius < 0) player.y = player.radius;
  if (player.y + player.radius > canvas.height)
    player.y = canvas.height - player.radius;

  // Kirim posisi baru ke server
  sendPlayerState();
}

// Render semua objek game
function render() {
  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Gambar lapangan
  drawField();

  // Gambar gol
  ctx.fillStyle = "white";
  for (const goal of goals) {
    ctx.fillRect(goal.x, goal.y, goal.width, goal.height);
  }

  // Gambar semua pemain
  Object.values(players).forEach((otherPlayer) => {
    // Skip pemain ini karena kita gambar dari state lokal
    if (otherPlayer.id === playerId) return;

    // Gambar pemain lain
    ctx.fillStyle = otherPlayer.team === 1 ? "red" : "blue";
    ctx.beginPath();
    ctx.arc(otherPlayer.x, otherPlayer.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Gambar tanda X merah jika pemain sedang tackling
    if (otherPlayer.isTackling) {
      // Tentukan warna X berdasarkan tim
      ctx.strokeStyle = otherPlayer.team === 1 ? "blue" : "red";
      ctx.lineWidth = 3;
      const xSize = PLAYER_RADIUS * 0.8;

      // Gambar garis X
      ctx.beginPath();
      ctx.moveTo(otherPlayer.x - xSize, otherPlayer.y - xSize);
      ctx.lineTo(otherPlayer.x + xSize, otherPlayer.y + xSize);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(otherPlayer.x + xSize, otherPlayer.y - xSize);
      ctx.lineTo(otherPlayer.x - xSize, otherPlayer.y + xSize);
      ctx.stroke();
    }

    // Gambar ultimate gauge untuk pemain lain jika ada
    if (otherPlayer.ultimateGauge > 0) {
      const gaugePercentage = otherPlayer.ultimateGauge / MAX_ULTIMATE_GAUGE;
      ctx.strokeStyle = getUltimateGaugeColor(gaugePercentage);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(
        otherPlayer.x,
        otherPlayer.y,
        PLAYER_RADIUS + 3,
        0,
        Math.PI * 2 * gaugePercentage
      );
      ctx.stroke();
    }

    // Menampilkan efek tendangan untuk pemain lain
    if (otherPlayer.isKicking) {
      ctx.strokeStyle = "white";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(otherPlayer.x, otherPlayer.y, PLAYER_RADIUS + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Gambar indikator dribbling untuk pemain lain
    if (otherPlayer.isDribbling) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(otherPlayer.x, otherPlayer.y);
      ctx.lineTo(ball.x, ball.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Gambar bar energi untuk pemain lain
    drawPlayerEnergyBar(otherPlayer);
  });

  // Gambar pemain ini (local player)
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  // Gambar tanda X merah jika pemain sedang tackling
  if (player.isTackling) {
    // Tentukan warna X berdasarkan tim
    ctx.strokeStyle = player.team === 1 ? "blue" : "red";
    ctx.lineWidth = 3;
    const xSize = player.radius * 0.8;

    // Gambar garis X
    ctx.beginPath();
    ctx.moveTo(player.x - xSize, player.y - xSize);
    ctx.lineTo(player.x + xSize, player.y + xSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(player.x + xSize, player.y - xSize);
    ctx.lineTo(player.x - xSize, player.y + xSize);
    ctx.stroke();
  }

  // Gambar ultimate gauge di sekitar pemain jika ada
  if (player.ultimateGauge > 0) {
    const gaugePercentage = player.ultimateGauge / MAX_ULTIMATE_GAUGE;

    // Menggambar indikator gauge sebagai lingkaran di sekitar pemain
    ctx.strokeStyle = getUltimateGaugeColor(gaugePercentage);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(
      player.x,
      player.y,
      player.radius + 3,
      0,
      Math.PI * 2 * gaugePercentage
    );
    ctx.stroke();

    // Jika gauge penuh, tambahkan efek kilau
    if (gaugePercentage >= 1) {
      ctx.strokeStyle =
        "rgba(255, 255, 0, " + (0.5 + Math.sin(Date.now() * 0.01) * 0.5) + ")";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Menambahkan lingkaran putih di sekitar pemain saat menekan spasi
  if (player.isKicking) {
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Gambar bola
  ctx.fillStyle = ball.color;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();

  // Indikator dribbling untuk pemain ini
  if (player.isDribbling) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(ball.x, ball.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Gambar bar energi di bawah pemain ini
  drawEnergyBar();

  // Tampilkan pesan OUT jika bola keluar
  if (outMessageTimer > 0) {
    drawOutMessage();
    outMessageTimer--;
  }

  // Tampilkan pesan GOAL jika terjadi gol
  if (goalMessageTimer > 0) {
    drawGoalMessage();
    goalMessageTimer--;
  }

  // Tampilkan ID dan nama tim pemain di pojok atas
  ctx.font = "14px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "left";
  ctx.fillText(`Player ID: ${playerId || "Connecting..."}`, 10, 20);
  ctx.fillText(`Team: ${player.team === 1 ? "Red" : "Blue"}`, 10, 40);
}

// Gambar lapangan
function drawField() {
  // Background lapangan (rumput)
  ctx.fillStyle = "#1a7c1e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Garis tepi putih (batas out)
  ctx.strokeStyle = "white";
  ctx.lineWidth = 4;
  ctx.strokeRect(0, 0, canvas.width, canvas.height);

  // Garis tengah
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();

  // Lingkaran tengah
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, 60, 0, Math.PI * 2);
  ctx.stroke();
}

// Fungsi untuk menggambar bar energi pemain lain
function drawPlayerEnergyBar(otherPlayer) {
  const barWidth = PLAYER_RADIUS * 2;
  const barHeight = 5;
  const energyPercentage = otherPlayer.energy / MAX_ENERGY;

  // Background bar (abu-abu)
  ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
  ctx.fillRect(
    otherPlayer.x - barWidth / 2,
    otherPlayer.y + PLAYER_RADIUS + 5,
    barWidth,
    barHeight
  );

  // Energy bar (hijau atau kuning atau merah berdasarkan level energi)
  if (energyPercentage > 0.7) {
    ctx.fillStyle = "rgba(0, 255, 0, 0.7)"; // Hijau
  } else if (energyPercentage > 0.3) {
    ctx.fillStyle = "rgba(255, 255, 0, 0.7)"; // Kuning
  } else {
    ctx.fillStyle = "rgba(255, 0, 0, 0.7)"; // Merah
  }

  ctx.fillRect(
    otherPlayer.x - barWidth / 2,
    otherPlayer.y + PLAYER_RADIUS + 5,
    barWidth * energyPercentage,
    barHeight
  );
}

// Fungsi untuk menggambar bar energi
function drawEnergyBar() {
  const barWidth = player.radius * 2;
  const barHeight = 5;
  const energyPercentage = player.energy / MAX_ENERGY;

  // Background bar (abu-abu)
  ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
  ctx.fillRect(
    player.x - barWidth / 2,
    player.y + player.radius + 5,
    barWidth,
    barHeight
  );

  // Energy bar (hijau atau kuning atau merah berdasarkan level energi)
  if (energyPercentage > 0.7) {
    ctx.fillStyle = "rgba(0, 255, 0, 0.7)"; // Hijau
  } else if (energyPercentage > 0.3) {
    ctx.fillStyle = "rgba(255, 255, 0, 0.7)"; // Kuning
  } else {
    ctx.fillStyle = "rgba(255, 0, 0, 0.7)"; // Merah
  }

  ctx.fillRect(
    player.x - barWidth / 2,
    player.y + player.radius + 5,
    barWidth * energyPercentage,
    barHeight
  );
}

// Fungsi untuk menampilkan pesan OUT
function drawOutMessage() {
  ctx.font = "bold 36px Arial";
  ctx.fillStyle =
    "rgba(255, 255, 255, " + outMessageTimer / OUT_MESSAGE_DURATION + ")";
  ctx.textAlign = "center";
  ctx.fillText("OUT", canvas.width / 2, canvas.height / 2 - 50);
}

// Fungsi untuk menampilkan pesan GOAL
function drawGoalMessage() {
  ctx.font = "bold 48px Arial";
  ctx.fillStyle =
    "rgba(255, 255, 0, " + goalMessageTimer / GOAL_MESSAGE_DURATION + ")";
  ctx.textAlign = "center";
  ctx.fillText("GOAL!", canvas.width / 2, canvas.height / 2 - 50);

  // Lingkaran penanda gol
  const pulseSize = 100 + Math.sin(goalMessageTimer * 0.1) * 30;
  ctx.strokeStyle =
    "rgba(255, 255, 0, " +
    (goalMessageTimer / GOAL_MESSAGE_DURATION) * 0.7 +
    ")";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, pulseSize, 0, Math.PI * 2);
  ctx.stroke();
}

// Fungsi untuk mendapatkan warna ultimate gauge berdasarkan persentase
function getUltimateGaugeColor(percentage) {
  if (percentage < 0.3) {
    return "rgba(0, 150, 255, 0.8)"; // Biru
  } else if (percentage < 0.7) {
    return "rgba(255, 165, 0, 0.8)"; // Oranye
  } else {
    return "rgba(255, 215, 0, 0.8)"; // Kuning keemasan
  }
}

// Fungsi untuk menampilkan efek visual saat pass
function showPassEffect() {
  // Efek kilatan sementara di sekitar bola
  const passEffect = {
    x: ball.x,
    y: ball.y,
    radius: ball.radius * 2,
    alpha: 1.0,
    decay: 0.1,
  };

  // Fungsi untuk menggambar efek pass
  function drawPassEffect() {
    if (passEffect.alpha > 0) {
      ctx.strokeStyle = `rgba(255, 255, 255, ${passEffect.alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(passEffect.x, passEffect.y, passEffect.radius, 0, Math.PI * 2);
      ctx.stroke();

      // Kurangi alpha untuk efek memudar
      passEffect.alpha -= passEffect.decay;

      // Kurangi ukuran lingkaran
      passEffect.radius += 1;

      // Lanjutkan animasi
      requestAnimationFrame(drawPassEffect);
    }
  }

  // Mulai animasi efek
  drawPassEffect();
}

// Game loop - kini hanya untuk rendering dan mengirim input
function gameLoop() {
  if (gameStarted) {
    updatePlayerPosition(); // Hanya update client-side untuk prediksi
  }
  render();
  requestAnimationFrame(gameLoop);
}

// Mulai game
gameLoop();

// Tampilkan pesan menunggu pemain lain
function showWaitingScreen() {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "30px Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.fillText("Menunggu pemain lain...", canvas.width / 2, canvas.height / 2);
}

// Game loop pembuka - tampilkan layar menunggu hingga game dimulai
function waitingLoop() {
  if (!gameStarted) {
    showWaitingScreen();
    requestAnimationFrame(waitingLoop);
  }
}

// Mulai dengan menampilkan layar menunggu
waitingLoop();
