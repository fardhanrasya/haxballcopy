// Pengaturan Canvas
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 1000;
canvas.height = 600;

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
const KICK_POWER = 7;
const PASS_POWER = 4; // Kekuatan pass lebih lemah dari tendangan tapi lebih presisi
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

// Objek Game
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
  energy: MAX_ENERGY, // Energi awal maksimal
  ultimateGauge: 0, // Ultimate gauge dimulai dari 0
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
      releaseBall();
    }
  }

  // Toggle mode dribbling dengan tombol K
  if (e.key.toLowerCase() === "k") {
    toggleDribble();
  }

  // Melakukan pass dengan tombol J
  if (e.key.toLowerCase() === "j") {
    passBall();
  }

  // Memulai tendangan dengan spasi
  if (e.key === " " && !player.isKicking) {
    // Jika sedang dribbling, hentikan dribbling terlebih dahulu
    if (player.isDribbling) {
      player.isDribbling = false;
    }
    // Tendang bola
    kickBall();
    player.isKicking = true;
  }
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
});

// Deteksi tabrakan antara dua lingkaran
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
    // Kurangi energi hanya saat berlari DAN bergerak
    player.energy = Math.max(0, player.energy - ENERGY_DRAIN_RATE);
  } else {
    // Mode berjalan atau tidak bergerak
    player.speed = PLAYER_WALK_SPEED;
    // Jika energi habis, matikan mode berlari
    if (player.energy <= 0) {
      player.isRunning = false;
    }
  }

  // Pulihkan energi jika tidak bergerak, terlepas dari tombol L
  if (!isMoving) {
    player.energy = Math.min(MAX_ENERGY, player.energy + ENERGY_RECOVERY_RATE);
  } else if (!player.isRunning) {
    // Atau jika bergerak tapi tidak berlari (berjalan)
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

  // Memindahkan logika tendangan ke event listener untuk tombol spasi
  // sehingga tidak ada lagi pengecekan tendangan di sini

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
}

// Tendang bola jika pemain cukup dekat
function kickBall() {
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
  }
}

// Fungsi untuk toggle mode dribbling
function toggleDribble() {
  const dx = ball.x - player.x;
  const dy = ball.y - player.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Hanya bisa dribble jika dekat dengan bola
  if (distance < PLAYER_RADIUS + BALL_RADIUS * 3) {
    player.isDribbling = !player.isDribbling;

    // Jika berhenti dribbling, beri sedikit dorongan ke bola
    if (!player.isDribbling) {
      releaseBall();
    }
  }
}

// Fungsi untuk melepaskan bola dari dribbling
function releaseBall() {
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

// Update posisi bola
function updateBallPosition() {
  // Jika dalam mode dribbling, bola mengikuti pemain
  if (player.isDribbling) {
    // Tentukan posisi bola berdasarkan arah gerakan pemain
    if (player.velocityX !== 0 || player.velocityY !== 0) {
      // Jika pemain bergerak, bola berada di depan pemain berdasarkan arah gerakan
      const moveSpeed = Math.sqrt(
        player.velocityX * player.velocityX +
          player.velocityY * player.velocityY
      );
      const moveAngle = Math.atan2(player.velocityY, player.velocityX);

      // Bola berada sedikit di depan pemain dalam arah gerakan
      const targetX = player.x + Math.cos(moveAngle) * DRIBBLE_DISTANCE;
      const targetY = player.y + Math.sin(moveAngle) * DRIBBLE_DISTANCE;

      // Gerakan bola menuju posisi ideal dengan efek smoothing
      ball.velocityX =
        (targetX - ball.x) * (1 - DRIBBLE_STRENGTH) + player.velocityX * 0.8;
      ball.velocityY =
        (targetY - ball.y) * (1 - DRIBBLE_STRENGTH) + player.velocityY * 0.8;

      // Tambahkan sedikit variasi pada bola saat dribbling
      ball.velocityX += Math.random() * 0.2 - 0.1;
      ball.velocityY += Math.random() * 0.2 - 0.1;
    } else {
      // Jika pemain diam, bola tetap dekat dengan pemain
      const dx = ball.x - player.x;
      const dy = ball.y - player.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const dirX = dx / distance;
        const dirY = dy / distance;

        // Target posisi ideal untuk dribbling saat diam
        const targetX = player.x + dirX * DRIBBLE_DISTANCE;
        const targetY = player.y + dirY * DRIBBLE_DISTANCE;

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

  // Jika kick dilakukan selama dribbling, lepaskan dribbling
  if (player.isKicking && player.isDribbling) {
    player.isDribbling = false;
  }

  // Deteksi jika bola keluar lapangan (out)
  if (
    ball.x - ball.radius < 0 ||
    ball.x + ball.radius > canvas.width ||
    ball.y - ball.radius < 0 ||
    ball.y + ball.radius > canvas.height
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

      // Matikan mode dribbling sebelum reset bola
      player.isDribbling = false;

      resetBall();
      return;
    }
  }

  // Deteksi gol
  checkGoal();

  // Deteksi tabrakan dengan pemain
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
      player.velocityX * player.velocityX + player.velocityY * player.velocityY
    );
    if (power > 0) {
      ball.velocityX = Math.cos(angle) * power * 0.8;
      ball.velocityY = Math.sin(angle) * power * 0.8;
    }
  }
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
        document.getElementById("team1").textContent = scoreTeam1;
      } else {
        scoreTeam2++;
        document.getElementById("team2").textContent = scoreTeam2;
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
  // Matikan mode dribbling saat bola direset
  player.isDribbling = false;

  // Reset posisi bola
  ball.x = canvas.width / 2;
  ball.y = canvas.height / 2;
  ball.velocityX = 0;
  ball.velocityY = 0;
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

  // Gambar pemain
  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

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

  // Indikator dribbling
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

  // Gambar bar energi di bawah pemain
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

// Fungsi untuk melakukan pass/mengoper bola
function passBall() {
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

    // Efek visual saat pass
    showPassEffect();

    // Terapkan kecepatan ke bola
    ball.velocityX = Math.cos(moveAngle) * PASS_POWER;
    ball.velocityY = Math.sin(moveAngle) * PASS_POWER;
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

// Game loop
function gameLoop() {
  updatePlayerPosition();
  updateBallPosition();
  render();
  requestAnimationFrame(gameLoop);
}

// Mulai game
resetBall();
gameLoop();
