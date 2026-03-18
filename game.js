// ============================================================
// Nose Dodge - 鼻で操作する横スクロールシューティング
// ============================================================

// --- MediaPipe imports (CDN) ---
import { FaceMesh } from "https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js";
import { Camera } from "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1640029074/camera_utils.js";

// --- DOM elements ---
const startScreen = document.getElementById("startScreen");
const startBtn = document.getElementById("startBtn");
const loadingMsg = document.getElementById("loadingMsg");
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const videoEl = document.getElementById("cameraView");

// --- Game constants ---
const PLAYER_SIZE = 28;
const BULLET_SPEED = 5;
const STAR_COUNT = 60;
const ENEMY_SPAWN_INTERVAL_MS = 1200;
const ENEMY_BULLET_INTERVAL_MS = 1800;
const DIFFICULTY_RAMP_INTERVAL_MS = 10000;

// --- Game state ---
let gameRunning = false;
let gameOver = false;
let score = 0;
let hiScore = parseInt(localStorage.getItem("noseDodgeHiScore") || "0", 10);
let noseX = 0.5; // normalized 0-1, from camera
let noseY = 0.5;
let smoothX = 0.5;
let smoothY = 0.5;
let faceDetected = false;
let player = { x: 0, y: 0 };
let enemies = [];
let enemyBullets = [];
let playerBullets = [];
let particles = [];
let stars = [];
let lastEnemySpawn = 0;
let difficultyLevel = 1;
let lastDifficultyRamp = 0;
let animFrameId = null;
let cameraReady = false;

// --- Resize ---
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// --- Stars (background) ---
function initStars() {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: 0.5 + Math.random() * 2,
      size: 0.5 + Math.random() * 1.5,
    });
  }
}
initStars();

function updateStars() {
  for (const s of stars) {
    s.x -= s.speed;
    if (s.x < 0) {
      s.x = canvas.width;
      s.y = Math.random() * canvas.height;
    }
  }
}

function drawStars() {
  ctx.fillStyle = "#fff";
  for (const s of stars) {
    ctx.globalAlpha = 0.3 + s.speed * 0.25;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
  ctx.globalAlpha = 1;
}

// --- Player ---
function drawPlayer() {
  const px = player.x;
  const py = player.y;
  const s = PLAYER_SIZE;
  // Fighter shape
  ctx.save();
  ctx.translate(px, py);
  // Engine glow
  ctx.fillStyle = "rgba(0,180,255,0.3)";
  ctx.beginPath();
  ctx.ellipse(-s * 0.6, 0, s * 0.5, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = "#0cf";
  ctx.strokeStyle = "#0af";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(-s * 0.6, -s * 0.6);
  ctx.lineTo(-s * 0.3, 0);
  ctx.lineTo(-s * 0.6, s * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Cockpit
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(s * 0.15, 0, s * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// --- Enemies ---
function spawnEnemy(now) {
  const minInterval = Math.max(400, ENEMY_SPAWN_INTERVAL_MS - difficultyLevel * 80);
  if (now - lastEnemySpawn < minInterval) return;
  lastEnemySpawn = now;

  const y = PLAYER_SIZE + Math.random() * (canvas.height - PLAYER_SIZE * 2);
  const speed = 1.5 + Math.random() * 1.5 + difficultyLevel * 0.2;
  enemies.push({
    x: canvas.width + 30,
    y,
    speed,
    size: 22,
    hp: 1,
    lastShot: now,
    shotInterval: Math.max(600, ENEMY_BULLET_INTERVAL_MS - difficultyLevel * 100),
  });
}

function updateEnemies(now) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.x -= e.speed;
    // Shoot at player
    if (now - e.lastShot > e.shotInterval && e.x < canvas.width - 50) {
      e.lastShot = now;
      const angle = Math.atan2(player.y - e.y, player.x - e.x);
      const speed = 3 + difficultyLevel * 0.3;
      enemyBullets.push({
        x: e.x - e.size,
        y: e.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5,
      });
    }
    // Off screen
    if (e.x < -40) {
      enemies.splice(i, 1);
    }
  }
}

function drawEnemies() {
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    const s = e.size;
    // Enemy body (red triangle pointing left)
    ctx.fillStyle = "#f44";
    ctx.strokeStyle = "#f88";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-s, 0);
    ctx.lineTo(s * 0.6, -s * 0.6);
    ctx.lineTo(s * 0.3, 0);
    ctx.lineTo(s * 0.6, s * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Eye
    ctx.fillStyle = "#ff0";
    ctx.beginPath();
    ctx.arc(-s * 0.15, 0, s * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// --- Bullets ---
function autoShoot(now) {
  // Player auto-fires
  if (!player.lastShot) player.lastShot = 0;
  const fireRate = 250;
  if (now - player.lastShot > fireRate) {
    player.lastShot = now;
    playerBullets.push({
      x: player.x + PLAYER_SIZE,
      y: player.y,
      vx: 8,
      vy: 0,
      size: 4,
    });
  }
}

function updateBullets() {
  // Player bullets
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.x > canvas.width + 10) playerBullets.splice(i, 1);
  }
  // Enemy bullets
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (b.x < -20 || b.x > canvas.width + 20 || b.y < -20 || b.y > canvas.height + 20) {
      enemyBullets.splice(i, 1);
    }
  }
}

function drawBullets() {
  // Player bullets
  ctx.fillStyle = "#0ff";
  ctx.shadowColor = "#0ff";
  ctx.shadowBlur = 6;
  for (const b of playerBullets) {
    ctx.fillRect(b.x - b.size, b.y - b.size / 2, b.size * 2, b.size);
  }
  // Enemy bullets
  ctx.fillStyle = "#f84";
  ctx.shadowColor = "#f44";
  for (const b of enemyBullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// --- Particles ---
function spawnExplosion(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 30 + Math.random() * 20,
      maxLife: 50,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// --- Collision detection ---
function checkCollisions() {
  // Player bullets vs enemies
  for (let bi = playerBullets.length - 1; bi >= 0; bi--) {
    const b = playerBullets[bi];
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      if (Math.sqrt(dx * dx + dy * dy) < e.size + b.size) {
        e.hp--;
        playerBullets.splice(bi, 1);
        if (e.hp <= 0) {
          score += 100;
          spawnExplosion(e.x, e.y, "#f84", 15);
          enemies.splice(ei, 1);
        }
        break;
      }
    }
  }
  // Enemy bullets vs player
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    const dx = b.x - player.x;
    const dy = b.y - player.y;
    if (Math.sqrt(dx * dx + dy * dy) < PLAYER_SIZE * 0.6 + b.size) {
      // Game over
      spawnExplosion(player.x, player.y, "#0ff", 30);
      endGame();
      return;
    }
  }
  // Enemy body vs player
  for (const e of enemies) {
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    if (Math.sqrt(dx * dx + dy * dy) < PLAYER_SIZE * 0.5 + e.size * 0.5) {
      spawnExplosion(player.x, player.y, "#0ff", 30);
      endGame();
      return;
    }
  }
}

// --- HUD ---
function drawHUD() {
  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE: ${score}`, 16, 34);
  ctx.fillStyle = "#8af";
  ctx.font = "14px sans-serif";
  ctx.fillText(`HI: ${hiScore}`, 16, 54);
  // Difficulty indicator
  ctx.fillStyle = "#ff8";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(`LV ${difficultyLevel}`, canvas.width - 16, 30);

  if (!faceDetected && gameRunning) {
    ctx.fillStyle = "rgba(255,100,100,0.8)";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("顔が検出されません - カメラに顔を映してください", canvas.width / 2, 80);
  }
}

// --- Game Over screen ---
function drawGameOver() {
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 40);
  ctx.font = "24px sans-serif";
  ctx.fillText(`SCORE: ${score}`, canvas.width / 2, canvas.height / 2 + 10);
  if (score >= hiScore) {
    ctx.fillStyle = "#ff0";
    ctx.fillText("NEW HIGH SCORE!", canvas.width / 2, canvas.height / 2 + 45);
  }
  ctx.fillStyle = "#8af";
  ctx.font = "18px sans-serif";
  ctx.fillText("タップでリトライ", canvas.width / 2, canvas.height / 2 + 85);
}

// --- Game lifecycle ---
function resetGame() {
  score = 0;
  enemies = [];
  enemyBullets = [];
  playerBullets = [];
  particles = [];
  difficultyLevel = 1;
  lastEnemySpawn = 0;
  lastDifficultyRamp = performance.now();
  player.x = canvas.width * 0.15;
  player.y = canvas.height / 2;
  gameOver = false;
  gameRunning = true;
}

function endGame() {
  gameRunning = false;
  gameOver = true;
  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem("noseDodgeHiScore", String(hiScore));
  }
}

// --- Main loop ---
function gameLoop(timestamp) {
  animFrameId = requestAnimationFrame(gameLoop);

  // Clear
  ctx.fillStyle = "#0a0a1e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  updateStars();
  drawStars();

  if (gameRunning) {
    // Smooth nose tracking
    const smoothing = 0.25;
    smoothX += (noseX - smoothX) * smoothing;
    smoothY += (noseY - smoothY) * smoothing;

    // Map nose position to game area (mirror X so moving right moves player right)
    player.x = (1 - smoothX) * canvas.width;
    player.y = smoothY * canvas.height;
    // Clamp
    player.x = Math.max(PLAYER_SIZE, Math.min(canvas.width * 0.5, player.x));
    player.y = Math.max(PLAYER_SIZE, Math.min(canvas.height - PLAYER_SIZE, player.y));

    // Difficulty ramp
    if (timestamp - lastDifficultyRamp > DIFFICULTY_RAMP_INTERVAL_MS) {
      difficultyLevel++;
      lastDifficultyRamp = timestamp;
    }

    // Survive score
    score += 1;

    spawnEnemy(timestamp);
    updateEnemies(timestamp);
    autoShoot(timestamp);
    updateBullets();
    checkCollisions();

    drawEnemies();
    drawBullets();
    if (gameRunning) drawPlayer(); // might have ended in checkCollisions
    drawHUD();
  }

  updateParticles();
  drawParticles();

  if (gameOver) {
    drawGameOver();
  }
}

// --- Retry on tap ---
document.addEventListener("pointerup", () => {
  if (gameOver) resetGame();
});

// --- MediaPipe face mesh setup ---
async function initCamera() {
  const faceMesh = new FaceMesh({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
  });
  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  faceMesh.onResults((results) => {
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      // Landmark 1 = nose tip in MediaPipe Face Mesh
      const nose = results.multiFaceLandmarks[0][1];
      noseX = nose.x; // 0-1
      noseY = nose.y; // 0-1
      faceDetected = true;
    } else {
      faceDetected = false;
    }
  });

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 240 } },
    audio: false,
  });
  videoEl.srcObject = stream;

  const mpCamera = new Camera(videoEl, {
    onFrame: async () => {
      await faceMesh.send({ image: videoEl });
    },
    width: 320,
    height: 240,
  });
  await mpCamera.start();
  cameraReady = true;
}

// --- Start button ---
startBtn.addEventListener("click", async () => {
  startBtn.disabled = true;
  loadingMsg.style.display = "block";
  loadingMsg.textContent = "カメラとAIモデルを読み込み中...";
  try {
    await initCamera();
    loadingMsg.textContent = "準備完了！";
    setTimeout(() => {
      startScreen.style.display = "none";
      resetGame();
      animFrameId = requestAnimationFrame(gameLoop);
    }, 500);
  } catch (err) {
    console.error(err);
    loadingMsg.textContent = `エラー: ${err.message}\nカメラへのアクセスを許可してください`;
    startBtn.disabled = false;
  }
});
