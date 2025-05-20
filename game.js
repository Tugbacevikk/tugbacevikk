// === CANVAS ve BAĞLAM ===
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// === GÖRSELLER ===
const bgImg = new Image(); bgImg.src = "assets/space-background.jpg";
const playerImg = new Image(); playerImg.src = "assets/alien-ufo.png";
const kalpImg = new Image(); kalpImg.src = "assets/heart.png";
const keyIcon = new Image(); keyIcon.src = "assets/key-icon.png";

// === SESLER ===
const bgMusic = new Audio("assets/space-ambient.mp3");
bgMusic.loop = true; bgMusic.volume = 0.3;
const collisionSound = new Audio("assets/house-door-closing.mp3");
collisionSound.volume = 0.7;

// === MÜZİK BAŞLATMA KONTROLÜ ===
function startMusic() {
  if (bgMusic.paused) {
    bgMusic.play().catch(e => console.warn("Müzik başlatılamadı:", e));
  }
}
window.addEventListener("click", startMusic);
window.addEventListener("keydown", startMusic);

// === ÇARPIŞMA SESİ ===
function playCollisionSound() {
  collisionSound.play().catch(e => console.warn("Çarpışma sesi çalınamadı:", e));
}

// === OYUNCU ve DURUMLAR ===
const GRAVITY = 0.7, PLAYER_SPEED = 4, JUMP_POWER = 15;
let player = { x: 50, y: 0, width: 40, height: 50, dx: 0, dy: 0, onGround: false, onLadder: false, facing: "right" };
let keysPressed = {}, bullets = [], score = 0, keysCollected = 0, gameOver = false, currentLevel = 0;
let showMessage = "", messageTimer = 0, canlar = 3, gameStarted = false;
let toplamAnahtarSayisi = 0;

// === SEVİYE OBJELERİ ===
let platforms = [], ladders = [], doors = [], enemies = [], obstacles = [], keys = [];

// === RASTGELE SEVİYE OLUŞTUR ===
function createRandomLevel(zorluk = 1) {
  const level = { platforms: [], ladders: [], doors: [], enemies: [], obstacles: [], keys: [] };
  level.platforms.push({ x: 0, y: 400, width: 800, height: 50 });

  const platformCount = Math.max(3, 6 - Math.floor(zorluk / 2));
  for (let i = 0; i < platformCount; i++) {
    const x = 80 + i * 140 + Math.random() * 40;
    const y = 350 - i * 40 - Math.random() * 30;
    level.platforms.push({ x, y, width: 100, height: 20 });
    if (Math.random() < 0.3) level.ladders.push({ x: x + 35, y: y, width: 30, height: 60 });
  }

  level.doors.push({ x: 740, y: 60, width: 40, height: 80 });

  const keyCount = 2 + Math.floor(zorluk / 2);
  for (let i = 0; i < keyCount; i++) {
    level.keys.push({ x: 100 + Math.random() * 600, y: 100 + Math.random() * 250, width: 20, height: 20 });
  }

  const enemyCount = 1 + Math.floor(zorluk);
  for (let i = 0; i < enemyCount; i++) {
    const ex = 100 + Math.random() * 600;
    const ey = 100 + Math.random() * 250;
    const dx = 1.5 + Math.random() * (0.5 + zorluk * 0.2);
    level.enemies.push({ x: ex, y: ey, width: 40, height: 30, dx: dx, range: [ex - 50, ex + 50] });
  }

  const obstacleCount = Math.floor(zorluk / 1.5);
  for (let i = 0; i < obstacleCount; i++) {
    const ox = 200 + Math.random() * 400;
    level.obstacles.push({ x: ox, y: 390, width: 80, height: 20, dx: 1 + Math.random(), range: [ox - 50, ox + 100] });
  }

  return level;
}

// === SEVİYE YÜKLE ===
function loadLevel(i) {
  const zorluk = Math.floor(i / 2) + 1;
  const lvl = createRandomLevel(zorluk);
  platforms = [...lvl.platforms];
  ladders = [...lvl.ladders];
  doors = [...lvl.doors];
  enemies = lvl.enemies.map(e => ({...e}));
  obstacles = lvl.obstacles.map(o => ({...o}));
  keys = lvl.keys.map(k => ({...k}));
  toplamAnahtarSayisi = keys.length;

  player.x = 50;
  player.y = platforms[0].y - player.height;
  player.dx = 0;
  player.dy = 0;
  player.onGround = false;
  player.onLadder = false;
  player.facing = "right";
  keysCollected = 0;
  showMessage = "";
  messageTimer = 0;
}

// === ÇARPIŞMA KONTROL ===
function isColliding(a, b) {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}
function checkLadder() { return ladders.some(l => isColliding(player, l)); }
function checkDoor() { return doors.some(d => isColliding(player, d)); }

// === MERMİ SİSTEMİ ===
function shootBullet() {
  const direction = player.facing === "right" ? 1 : -1;
  bullets.push({ x: player.x + (direction === 1 ? player.width : -10), y: player.y + player.height / 2 - 5, width: 10, height: 10, speed: 10 * direction });
}
function updateBullets() {
  const yeniMermiler = [];
  const silinecekDusmanlar = new Set();
  for (let bullet of bullets) {
    bullet.x += bullet.speed;
    if (bullet.x < 0 || bullet.x > canvas.width) continue;
    for (let j = 0; j < enemies.length; j++) {
      if (isColliding(bullet, enemies[j])) {
        silinecekDusmanlar.add(j);
        score += 100;
        playCollisionSound();
        break;
      }
    }
    if (!silinecekDusmanlar.has(bullets.indexOf(bullet))) yeniMermiler.push(bullet);
  }
  enemies = enemies.filter((_, i) => !silinecekDusmanlar.has(i));
  bullets = yeniMermiler;
}

// === ENGEL HAREKETİ ===
function updateObstacles() {
  for (let o of obstacles) {
    o.x += o.dx;
    if (o.dx !== 0 && (o.x < o.range[0] || o.x + o.width > o.range[1])) o.dx *= -1;
  }
}

// === CAN SİSTEMİ ===
function kaybetCan() {
  canlar--;
  playCollisionSound();
  if (canlar <= 0) {
    gameOver = true;
    showMessage = `OYUN BİTTİ - Skor: ${score} - Enter ile Yeniden Başla`;
  } else {
    player.x = 50;
    player.y = platforms[0].y - player.height;
    player.dx = 0; player.dy = 0;
  }
}
function restartGame() {
  score = 0;
  keysCollected = 0;
  canlar = 3;
  currentLevel = 0;
  gameOver = false;
  showMessage = "";
  bullets = [];
  gameStarted = false;
}

// === GÜNCELLE ===
function update() {
  if (!gameStarted || gameOver) return;
  if (messageTimer > 0) { messageTimer--; return; }

  player.onLadder = checkLadder();
  player.dy += player.onLadder ? 0 : GRAVITY;
  if (keysPressed.up && player.onLadder) player.y -= PLAYER_SPEED;
  if (keysPressed.down && player.onLadder) player.y += PLAYER_SPEED;

  player.dx = 0;
  if (keysPressed.left) { player.dx = -PLAYER_SPEED; player.facing = "left"; }
  if (keysPressed.right) { player.dx = PLAYER_SPEED; player.facing = "right"; }
  if (keysPressed.jump && player.onGround && !player.onLadder) {
    player.dy = -JUMP_POWER;
    player.onGround = false;
  }

  player.x += player.dx;
  player.y += player.dy;
  player.onGround = false;

  if (player.x < 0) player.x = 0;
  if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

  for (let p of platforms) {
    if (isColliding(player, p)) {
      if (player.dy >= 0 && player.y + player.height - player.dy <= p.y) {
        player.y = p.y - player.height;
        player.dy = 0;
        player.onGround = true;
      } else {
        if (player.dx > 0) player.x = p.x - player.width;
        else if (player.dx < 0) player.x = p.x + p.width;
        player.dx = 0;
      }
    }
  }

  for (let e of enemies) {
    e.x += e.dx;
    if (e.x < e.range[0] || e.x + e.width > e.range[1]) e.dx *= -1;
    if (isColliding(player, e)) { kaybetCan(); return; }
  }

  updateObstacles();
  for (let o of obstacles) if (isColliding(player, o)) { kaybetCan(); return; }

  for (let i = keys.length - 1; i >= 0; i--) {
    if (isColliding(player, keys[i])) {
      keys.splice(i, 1);
      keysCollected++;
      score += 100;
    }
  }

  if (checkDoor() && keysCollected === toplamAnahtarSayisi) {
    currentLevel++;
    loadLevel(currentLevel);
    showMessage = "Yeni Bölüm!";
    messageTimer = 60;
  }

  if (player.y > canvas.height) kaybetCan();
  updateBullets();
}

// === ÇİZ ===
function draw() {
  const now = Date.now();
  ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);

  // Oyun başlamadıysa mesaj göster
  if (!gameStarted && !gameOver) {
    ctx.fillStyle = "white";
    ctx.font = "28px Arial";
    ctx.textAlign = "center";
    ctx.fillText("Oyuna başlamak için ENTER'a basın", canvas.width / 2, canvas.height / 2);
    ctx.textAlign = "start";
    return;
  }

  ctx.fillStyle = "brown"; platforms.forEach(p => ctx.fillRect(p.x, p.y, p.width, p.height));
  ctx.fillStyle = "#666"; ladders.forEach(l => ctx.fillRect(l.x, l.y, l.width, l.height));
  ctx.fillStyle = keysCollected === toplamAnahtarSayisi ? "green" : "purple";
  doors.forEach(d => ctx.fillRect(d.x, d.y, d.width, d.height));
  ctx.fillStyle = "red"; enemies.forEach(e => ctx.fillRect(e.x, e.y, e.width, e.height));

  // Dikenli engeller üçgen olarak çiziliyor
  ctx.fillStyle = "#a00";
  obstacles.forEach(o => {
    if (o.dx !== 0) {
      ctx.beginPath();
      ctx.moveTo(o.x, o.y + o.height);
      ctx.lineTo(o.x + o.width / 2, o.y);
      ctx.lineTo(o.x + o.width, o.y + o.height);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(o.x, o.y, o.width, o.height);
    }
  });

  ctx.fillStyle = "gold";
  keys.forEach((k, i) => {
    const glow = Math.sin(now / 200 + i) * 4;
    ctx.beginPath();
    ctx.arc(k.x + k.width / 2, k.y + k.height / 2 + glow, k.width / 2, 0, Math.PI * 2);
    ctx.fill();
  });

  if (playerImg.complete) ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
  else { ctx.fillStyle = "lime"; ctx.fillRect(player.x, player.y, player.width, player.height); }

  ctx.fillStyle = "yellow"; bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(10, 10, 220, 70);
  ctx.fillStyle = "white"; ctx.font = "16px Arial";
  ctx.fillText(`Skor: ${score}`, 40, 30);
  ctx.fillText(`${keysCollected}/${toplamAnahtarSayisi}`, 40, 50);
  if (keyIcon.complete) ctx.drawImage(keyIcon, 20, 37, 16, 16);
  for (let i = 0; i < canlar; i++) if (kalpImg.complete) ctx.drawImage(kalpImg, 20 + i * 20, 55, 16, 16);

  if (showMessage && (messageTimer > 0 || gameOver)) {
    ctx.fillStyle = "white";
    ctx.font = "32px Arial";
    ctx.textAlign = "center";
    ctx.fillText(showMessage, canvas.width / 2, canvas.height / 2);
    ctx.textAlign = "start";
  }
}

// === DÖNGÜ ===
function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

// === KONTROLLER ===
window.addEventListener("keydown", e => {
  if (e.key === "Enter") {
    if (!gameStarted) {
      gameStarted = true;
      loadLevel(currentLevel);
    } else if (gameOver) {
      restartGame();
    }
  }

  if (!gameStarted || gameOver) return;

  if (e.key === "ArrowLeft") keysPressed.left = true;
  if (e.key === "ArrowRight") keysPressed.right = true;
  if (e.key === "ArrowUp") keysPressed.up = true;
  if (e.key === "ArrowDown") keysPressed.down = true;
  if (e.key === " " || e.key === "ArrowUp") keysPressed.jump = true;
  if (e.key.toLowerCase() === "f") shootBullet();
});
window.addEventListener("keyup", e => {
  if (e.key === "ArrowLeft") keysPressed.left = false;
  if (e.key === "ArrowRight") keysPressed.right = false;
  if (e.key === "ArrowUp") keysPressed.up = false;
  if (e.key === "ArrowDown") keysPressed.down = false;
  if (e.key === " " || e.key === "ArrowUp") keysPressed.jump = false;
});

// === BAŞLAT ===
window.onload = () => {
  gameLoop();
};
