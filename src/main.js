import * as THREE from "../vendor/three.module.js";

// Data collection (optional)
// - Create a Google Apps Script web app endpoint (see DATA_COLLECTION.md)
// - Paste the deployed URL here
const DATA_ENDPOINT =
  "https://script.google.com/macros/s/AKfycbxeTn81b9I2g7LhtPTqfMj8qo65fxChA7TwfZypSh3cczh881DOXHRapLtHmI9wjXtN/exec";

const ARENA_RADIUS = 25;
const WALL_HEIGHT = 6;
const WALL_THICKNESS = 1.2;
const WALL_SEGMENTS = 64;

const PLAYER_MAX_SPEED = 24;
const ENEMY_MAX_SPEED = 11;
const ACCELERATION = 75;
const DRAG_WHEN_MOVING = 2.5;
const FRICTION_WHEN_STOPPING = 14;

const WAVE_INTERVAL = 10;
const WAVE_SPAWN_INTERVAL = 0.3;

const HOMING_RADIUS = 3.5;
const HOMING_STRENGTH = 0.2;
const WANDER_INTERVAL = 1.5;

const DAMAGE_PER_SECOND = 20;
const MAX_HEALTH = 100;
const POWERUP_DURATION = 6;
const POWERUP_SPEED_MULT = 1.35;
const POWERUP_MEDKIT_HEAL = 40;
const POWERUP_SHIELD_DURATION = 3;
const POWERUP_STUN_DURATION = 2.5;
const POWERUP_NUKE_WEIGHT = 0.2;

const playerRadius = 1.1;
const enemyRadius = 1.0;
const powerupRadius = 0.9;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0f14);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(32, 28, 32);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(30, 40, 20);
scene.add(dirLight);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(ARENA_RADIUS, 64),
  new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0.02 })
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const createStreetTexture = (size = 1024) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const px = (v) => Math.round(v * size);

  const sidewalkColor = "#b3b8c2";
  const sidewalkDark = "#9aa1ad";
  const grassColor = "#2f6a3a";
  const grassDark = "#24522d";
  const roadColor = "#2a2d35";
  const roadDark = "#22242b";

  ctx.fillStyle = "#0e0f14";
  ctx.fillRect(0, 0, size, size);

  // Horizontal stripes (v-axis): sidewalk | grass | road | grass | sidewalk
  const sidewalkH = 0.12;
  const grassH = 0.10;
  const roadH = 1 - sidewalkH * 2 - grassH * 2;

  const y0 = 0;
  const y1 = sidewalkH;
  const y2 = y1 + grassH;
  const y3 = y2 + roadH;
  const y4 = y3 + grassH;
  const y5 = 1;

  // Sidewalks
  ctx.fillStyle = sidewalkColor;
  ctx.fillRect(0, px(y0), size, px(y1 - y0));
  ctx.fillRect(0, px(y4), size, px(y5 - y4));

  // Sidewalk seams
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i += 1) {
    const x = ((i + 0.5) / 10) * size;
    ctx.beginPath();
    ctx.moveTo(x, px(y0));
    ctx.lineTo(x, px(y1));
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, px(y4));
    ctx.lineTo(x, px(y5));
    ctx.stroke();
  }

  // Grass strips (hellstrips)
  ctx.fillStyle = grassColor;
  ctx.fillRect(0, px(y1), size, px(y2 - y1));
  ctx.fillRect(0, px(y3), size, px(y4 - y3));

  // Grass noise
  for (let i = 0; i < 1800; i += 1) {
    const x = Math.random() * size;
    const band = Math.random() < 0.5 ? [y1, y2] : [y3, y4];
    const y = (band[0] + Math.random() * (band[1] - band[0])) * size;
    const w = 1 + Math.random() * 2;
    const h = 1 + Math.random() * 3;
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.06)";
    ctx.fillRect(x, y, w, h);
  }

  // Road
  ctx.fillStyle = roadColor;
  ctx.fillRect(0, px(y2), size, px(y3 - y2));

  // Road noise / speckle
  for (let i = 0; i < 5000; i += 1) {
    const x = Math.random() * size;
    const y = (y2 + Math.random() * (y3 - y2)) * size;
    ctx.fillStyle = Math.random() < 0.6 ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.08)";
    ctx.fillRect(x, y, 1, 1);
  }

  // Slight darker tire-wear banding
  ctx.fillStyle = "rgba(0,0,0,0.10)";
  const roadTop = px(y2);
  const roadBottom = px(y3);
  const roadMid = (roadTop + roadBottom) / 2;
  ctx.fillRect(0, roadMid - 70, size, 24);
  ctx.fillRect(0, roadMid + 46, size, 24);

  // Edge lines (white)
  ctx.strokeStyle = "rgba(240,240,240,0.55)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, roadTop + 10);
  ctx.lineTo(size, roadTop + 10);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, roadBottom - 10);
  ctx.lineTo(size, roadBottom - 10);
  ctx.stroke();

  // Center dashed yellow line
  ctx.strokeStyle = "rgba(255, 205, 64, 0.85)";
  ctx.lineWidth = 6;
  ctx.setLineDash([28, 22]);
  ctx.beginPath();
  ctx.moveTo(0, roadMid);
  ctx.lineTo(size, roadMid);
  ctx.stroke();
  ctx.setLineDash([]);

  // Curbs (subtle darker band between sidewalk/grass and grass/road)
  ctx.fillStyle = sidewalkDark;
  ctx.fillRect(0, px(y1) - 6, size, 6);
  ctx.fillRect(0, px(y4), size, 6);
  ctx.fillStyle = roadDark;
  ctx.fillRect(0, roadTop, size, 6);
  ctx.fillRect(0, roadBottom - 6, size, 6);
  ctx.fillStyle = grassDark;
  ctx.fillRect(0, px(y2) - 4, size, 4);
  ctx.fillRect(0, px(y3), size, 4);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
};

floor.material.map = createStreetTexture();
floor.material.needsUpdate = true;

const wallSegments = [];
const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0x2d3b52,
  roughness: 0.8,
  metalness: 0.1,
  transparent: true,
  opacity: 1,
});

for (let i = 0; i < WALL_SEGMENTS; i += 1) {
  const angleStart = (i / WALL_SEGMENTS) * Math.PI * 2;
  const angleEnd = ((i + 1) / WALL_SEGMENTS) * Math.PI * 2;
  const angleMid = (angleStart + angleEnd) / 2;
  const segmentAngle = angleEnd - angleStart;
  const wallRingRadius = ARENA_RADIUS + WALL_THICKNESS / 2;
  const chordLength = 2 * wallRingRadius * Math.sin(segmentAngle / 2) + 0.25;
  const geometry = new THREE.BoxGeometry(chordLength, WALL_HEIGHT, WALL_THICKNESS);
  const segment = new THREE.Mesh(geometry, wallMaterial.clone());
  segment.position.set(
    Math.cos(angleMid) * wallRingRadius,
    WALL_HEIGHT / 2,
    Math.sin(angleMid) * wallRingRadius
  );
  segment.rotation.y = -(angleMid + Math.PI / 2);
  scene.add(segment);
  wallSegments.push(segment);
}

const loader = new THREE.TextureLoader();
const configureSpriteTexture = (texture) => {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
};

const playerTexture = configureSpriteTexture(loader.load("assets/sprites/player.png"));
const enemyTexture = configureSpriteTexture(loader.load("assets/sprites/enemy.png"));

const playerMaterial = new THREE.SpriteMaterial({ map: playerTexture, transparent: true });
const enemyMaterial = new THREE.SpriteMaterial({ map: enemyTexture, transparent: true });

const createTokenTexture = ({ accent = "#34d399", glyph = "⚡" } = {}) => {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");

  const glow = ctx.createRadialGradient(48, 48, 6, 48, 48, 44);
  const accentRgb = accent.startsWith("#") ? accent : "#34d399";
  const r = parseInt(accentRgb.slice(1, 3), 16);
  const g = parseInt(accentRgb.slice(3, 5), 16);
  const b = parseInt(accentRgb.slice(5, 7), 16);
  glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.55)`);
  glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 96, 96);

  ctx.fillStyle = "rgba(16, 20, 30, 0.95)";
  ctx.beginPath();
  ctx.arc(48, 48, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(48, 48, 28, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.95)`;
  ctx.font = "bold 30px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(glyph, 48, 50);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  return texture;
};

const powerupMaterials = {
  adrenaline: new THREE.SpriteMaterial({ map: createTokenTexture({ accent: "#34d399", glyph: "⚡" }), transparent: true }),
  medkit: new THREE.SpriteMaterial({ map: createTokenTexture({ accent: "#fb7185", glyph: "✚" }), transparent: true }),
  shield: new THREE.SpriteMaterial({ map: createTokenTexture({ accent: "#60a5fa", glyph: "S" }), transparent: true }),
  stun: new THREE.SpriteMaterial({ map: createTokenTexture({ accent: "#fbbf24", glyph: "★" }), transparent: true }),
  nuke: new THREE.SpriteMaterial({ map: createTokenTexture({ accent: "#a78bfa", glyph: "N" }), transparent: true }),
};

const player = new THREE.Sprite(playerMaterial);
player.scale.set(2.4, 2.4, 1);
player.position.set(0, 1.2, 0);
scene.add(player);

const enemies = [];

const uiWave = document.getElementById("waveValue");
const uiTimer = document.getElementById("timerValue");
const uiHealth = document.getElementById("healthValue");
const uiWaveLine = document.getElementById("waveLine");
const uiHudCard = document.getElementById("hudCard");
const uiBestWave = document.getElementById("bestWave");
const uiBestTime = document.getElementById("bestTime");
const uiPowerValue = document.getElementById("powerValue");
const uiShieldValue = document.getElementById("shieldValue");
const uiStunValue = document.getElementById("stunValue");
const restartOverlay = document.getElementById("restart");
const hurtFlash = document.getElementById("hurtFlash");
const whiteout = document.getElementById("whiteout");
const deathHeadline = document.getElementById("deathHeadline");
const menuOverlay = document.getElementById("menu");
const pauseOverlay = document.getElementById("pause");
const startBtn = document.getElementById("startBtn");
const menuSprites = document.getElementById("menuSprites");
const resumeBtn = document.getElementById("resumeBtn");
const restartBtn = document.getElementById("restartBtn");
const menuBtn = document.getElementById("menuBtn");
const reviveAnswer = document.getElementById("reviveAnswer");
const reviveBtn = document.getElementById("reviveBtn");
const restartFromDeathBtn = document.getElementById("restartFromDeathBtn");
const reviveError = document.getElementById("reviveError");
const revivePrompt = document.getElementById("revivePrompt");
const reviveChoices = document.getElementById("reviveChoices");
const reviveForm = document.getElementById("reviveForm");
const reviveTip = document.getElementById("reviveTip");
const reviveSolution = document.getElementById("reviveSolution");
const continueBtn = document.getElementById("continueBtn");
const continueRestartBtn = document.getElementById("continueRestartBtn");

const keys = new Set();
let health = MAX_HEALTH;
let elapsed = 0;
let wave = 1;
let waveTimer = 0;
let spawnRemaining = 0;
let spawnTimer = 0;
let mode = "menu"; // menu | playing | paused | gameover | nuking
let deathCause = "zombies"; // zombies | nuke
let previousOverlaps = 0;
let hurtFlashTimer = 0;
let invulnTimer = 0;

let questionBank = [];
let activeQuestion = null;
let lastQuestionId = null;
let reviveLocked = false;

const recordReviveAttempt = async ({ questionId, correct }) => {
  if (!DATA_ENDPOINT) return;
  if (!questionId) return;
  try {
    // Use no-cors + text/plain to avoid CORS/preflight issues with Apps Script.
    await fetch(DATA_ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ questionId, correct: Boolean(correct) }),
    });
  } catch {
    // Best-effort only; ignore network errors.
  }
};

let bestScore = { wave: 0, time: 0 };
let lastWaveUi = 0;
let lastBestSecond = -1;
let adrenalineTimer = 0;
let shieldTimer = 0;
let stunTimer = 0;
const powerups = [];

const cameraBasePosition = camera.position.clone();
let nukePhase = null; // null | freeze | shake | fade
let nukePhaseTimer = 0;
const NUKE_FREEZE_DURATION = 0.18;
const NUKE_SHAKE_DURATION = 0.55;
const NUKE_FADE_DURATION = 0.42;
const NUKE_SHAKE_INTENSITY = 1.2;

let menuDriftTimer = null;
const clearMenuDrift = () => {
  if (menuDriftTimer) {
    clearTimeout(menuDriftTimer);
    menuDriftTimer = null;
  }
  if (menuSprites) menuSprites.replaceChildren();
};

const scheduleMenuDrift = () => {
  if (!menuSprites) return;
  if (mode !== "menu") return;

  const spawn = () => {
    if (mode !== "menu") return;

    const sprite = document.createElement("div");
    sprite.className = "menu-sprite";
    sprite.style.backgroundImage = "url('assets/sprites/enemy.png')";

    const size = 64 + Math.random() * 72;
    sprite.style.width = `${size}px`;
    sprite.style.height = `${size}px`;

    const top = 8 + Math.random() * 76;
    sprite.style.top = `${top}vh`;

    const opacity = 0.12 + Math.random() * 0.18;
    sprite.style.opacity = `${opacity}`;

    const duration = 7 + Math.random() * 6;
    sprite.style.animationDuration = `${duration}s`;

    menuSprites.appendChild(sprite);
    sprite.addEventListener("animationend", () => sprite.remove(), { once: true });

    const nextDelay = 1300 + Math.random() * 2200;
    menuDriftTimer = setTimeout(spawn, nextDelay);
  };

  const initialDelay = 400 + Math.random() * 900;
  menuDriftTimer = setTimeout(spawn, initialDelay);
};

const playerVelocity = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const tempVector = new THREE.Vector3();
const tempVectorA = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const cameraForward = new THREE.Vector3();
const cameraRight = new THREE.Vector3();
const upVector = new THREE.Vector3(0, 1, 0);

const ARENA_INNER_RADIUS = ARENA_RADIUS - WALL_THICKNESS * 0.6;
const constrainToArena = (position, velocity, buffer = 0) => {
  const limit = ARENA_INNER_RADIUS - buffer;
  tempVector.set(position.x, 0, position.z);
  const dist = tempVector.length();
  if (dist <= limit) return;

  tempVector.multiplyScalar(1 / dist);
  position.x = tempVector.x * limit;
  position.z = tempVector.z * limit;

  if (velocity) {
    const radialDot = velocity.x * tempVector.x + velocity.z * tempVector.z;
    velocity.x -= tempVector.x * radialDot;
    velocity.z -= tempVector.z * radialDot;
  }
};

const spawnPoint = new THREE.Vector3(-ARENA_RADIUS + 1, 1.2, 0);

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const loadBestScore = () => {
  try {
    const raw = localStorage.getItem("zombie_arena_best");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && Number.isFinite(parsed.wave) && Number.isFinite(parsed.time)) {
      bestScore = { wave: Math.max(0, parsed.wave), time: Math.max(0, parsed.time) };
    }
  } catch {
    // ignore
  }
};

const saveBestScore = () => {
  try {
    localStorage.setItem("zombie_arena_best", JSON.stringify(bestScore));
  } catch {
    // ignore
  }
};

const updateBestScoreIfNeeded = () => {
  const current = { wave, time: elapsed };
  const better =
    current.wave > bestScore.wave || (current.wave === bestScore.wave && current.time > bestScore.time);
  if (!better) return;
  bestScore = { wave: current.wave, time: current.time };
  saveBestScore();
};

const waveColors = ["#6ee7ff", "#a78bfa", "#34d399", "#fbbf24", "#fb7185", "#60a5fa", "#f472b6", "#22d3ee"];
const applyWaveColor = () => {
  const color = waveColors[(Math.max(1, wave) - 1) % waveColors.length];
  const uiRoot = document.getElementById("ui");
  uiRoot?.style.setProperty("--wave-color", color);
};

const updateUI = () => {
  const timeText = formatTime(elapsed);

  if (uiWave) uiWave.textContent = String(wave);
  if (uiTimer) uiTimer.textContent = timeText;
  if (uiHealth) uiHealth.textContent = String(Math.max(0, Math.floor(health)));

  if (uiBestWave) uiBestWave.textContent = bestScore.wave ? String(bestScore.wave) : "-";
  if (uiBestTime) uiBestTime.textContent = bestScore.time ? formatTime(bestScore.time) : "--:--";

  if (uiHudCard) {
    if (health <= 25) uiHudCard.classList.add("health-danger");
    else uiHudCard.classList.remove("health-danger");
    if (adrenalineTimer > 0) uiHudCard.classList.add("power-active");
    else uiHudCard.classList.remove("power-active");
    if (shieldTimer > 0) uiHudCard.classList.add("shield-active");
    else uiHudCard.classList.remove("shield-active");
    if (stunTimer > 0) uiHudCard.classList.add("stun-active");
    else uiHudCard.classList.remove("stun-active");
  }

  if (uiPowerValue) uiPowerValue.textContent = adrenalineTimer > 0 ? `${adrenalineTimer.toFixed(1)}s` : "0.0s";
  if (uiShieldValue) uiShieldValue.textContent = shieldTimer > 0 ? `${shieldTimer.toFixed(1)}s` : "0.0s";
  if (uiStunValue) uiStunValue.textContent = stunTimer > 0 ? `${stunTimer.toFixed(1)}s` : "0.0s";

  if (lastWaveUi !== wave && uiWaveLine) {
    uiWaveLine.classList.remove("wave-pop");
    // eslint-disable-next-line no-unused-expressions
    uiWaveLine.offsetWidth;
    uiWaveLine.classList.add("wave-pop");
    lastWaveUi = wave;
    applyWaveColor();
  }
};

const createEnemy = () => {
  const sprite = new THREE.Sprite(enemyMaterial.clone());
  sprite.scale.set(2.2, 2.2, 1);
  sprite.position.copy(spawnPoint);
  scene.add(sprite);

  const enemy = {
    sprite,
    velocity: new THREE.Vector3(),
    wanderTarget: randomArenaPoint(),
    wanderTimer: 0,
  };
  enemies.push(enemy);
};

const randomArenaPoint = () => {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.sqrt(Math.random()) * (ARENA_RADIUS - 2);
  return new THREE.Vector3(Math.cos(angle) * radius, 1.2, Math.sin(angle) * radius);
};

const startWave = () => {
  spawnRemaining = 3 + (wave - 1) * 2;
  spawnTimer = 0;
  // 50% chance to spawn one power-up each wave.
  if (Math.random() < 0.5) spawnPowerup();
};

const spawnPowerup = () => {
  const type = pickPowerupType();
  const material = powerupMaterials[type]?.clone?.() ?? powerupMaterials.adrenaline.clone();
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.0, 2.0, 1);

  const pos = randomArenaPoint();
  pos.y = 1.2;
  sprite.position.copy(pos);
  scene.add(sprite);

  powerups.push({ type, sprite });
};

const pickPowerupType = () => {
  const normal = [
    { type: "adrenaline", weight: 1 },
    { type: "medkit", weight: 1 },
    { type: "shield", weight: 1 },
    { type: "stun", weight: 1 },
  ];
  const all = [...normal, { type: "nuke", weight: POWERUP_NUKE_WEIGHT }];
  const total = all.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of all) {
    roll -= item.weight;
    if (roll <= 0) return item.type;
  }
  return "adrenaline";
};

const resetGame = () => {
  enemies.forEach((enemy) => scene.remove(enemy.sprite));
  enemies.length = 0;
  player.position.set(0, 1.2, 0);
  playerVelocity.set(0, 0, 0);
  keys.clear();
  health = MAX_HEALTH;
  elapsed = 0;
  wave = 1;
  waveTimer = 0;
  spawnRemaining = 0;
  spawnTimer = 0;
  deathCause = "zombies";
  restartOverlay.style.display = "none";
  pauseOverlay.style.display = "none";
  previousOverlaps = 0;
  hurtFlashTimer = 0;
  invulnTimer = 0;
  if (hurtFlash) hurtFlash.classList.remove("flash");
  if (reviveAnswer) reviveAnswer.value = "";
  if (reviveError) reviveError.textContent = "";
  if (reviveSolution) reviveSolution.textContent = "";
  if (reviveSolution) reviveSolution.style.display = "none";
  if (continueBtn) continueBtn.style.display = "none";
  reviveLocked = false;
  activeQuestion = null;
  lastWaveUi = 0;
  lastBestSecond = -1;
  applyWaveColor();
  adrenalineTimer = 0;
  shieldTimer = 0;
  stunTimer = 0;
  powerups.forEach((p) => scene.remove(p.sprite));
  powerups.length = 0;
  nukePhase = null;
  nukePhaseTimer = 0;
  camera.position.copy(cameraBasePosition);
  if (whiteout) {
    whiteout.style.opacity = "0";
    whiteout.style.display = "none";
  }
  startWave();
  updateUI();
};

const normalizeAnswer = (value) => String(value ?? "").trim().toLowerCase();

const loadQuestions = async () => {
  try {
    const response = await fetch("data/questions_isat.json", { cache: "no-store" });
    if (!response.ok) return;
    const json = await response.json();
    if (!json || !Array.isArray(json.questions)) return;
    questionBank = json.questions.filter((q) => q && typeof q.prompt === "string" && typeof q.answer === "string");
  } catch {
    // Ignore; falls back to a simple revive prompt.
  }
};

const pickQuestion = () => {
  if (!questionBank.length) return null;
  if (questionBank.length === 1) return questionBank[0];
  let attempts = 0;
  while (attempts < 5) {
    const candidate = questionBank[Math.floor(Math.random() * questionBank.length)];
    if (candidate?.id && candidate.id === lastQuestionId) {
      attempts += 1;
      continue;
    }
    lastQuestionId = candidate?.id ?? null;
    return candidate;
  }
  return questionBank[Math.floor(Math.random() * questionBank.length)];
};

const renderReviveQuestion = () => {
  if (!revivePrompt || !reviveChoices || !reviveForm || !reviveTip) return;
  reviveLocked = false;
  if (reviveSolution) {
    reviveSolution.textContent = "";
    reviveSolution.style.display = "none";
  }
  if (continueBtn) continueBtn.style.display = "none";

  const q = activeQuestion;
  if (!q) {
    revivePrompt.textContent = 'Answer to revive. (For now the answer is "1".)';
    reviveChoices.style.display = "none";
    reviveChoices.replaceChildren();
    reviveForm.style.display = "flex";
    reviveAnswer?.setAttribute("inputmode", "numeric");
    reviveAnswer?.setAttribute("placeholder", "Type answer");
    reviveTip.textContent = "Tip: press Enter to revive • press R to restart";
    setTimeout(() => reviveAnswer?.focus(), 0);
    return;
  }

  revivePrompt.textContent = q.prompt;
  if (reviveError) reviveError.textContent = "";

  const type = String(q.type ?? "short").toLowerCase();
  if (type === "mcq" && Array.isArray(q.choices) && q.choices.length) {
    reviveChoices.replaceChildren();
    q.choices.forEach((choice) => {
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.textContent = String(choice);
      btn.addEventListener("click", () => attemptRevive(String(choice)));
      reviveChoices.appendChild(btn);
    });
    reviveChoices.style.display = "flex";
    reviveForm.style.display = "none";
    reviveTip.textContent = "Tip: click an answer • press R to restart";
  } else {
    reviveChoices.style.display = "none";
    reviveChoices.replaceChildren();
    reviveForm.style.display = "flex";
    reviveAnswer?.setAttribute("inputmode", "text");
    reviveAnswer?.setAttribute("placeholder", "Type answer");
    reviveTip.textContent = "Tip: press Enter to revive • press R to restart";
    setTimeout(() => reviveAnswer?.focus(), 0);
  }
};

const showReviveFailure = (correctAnswer, explanation) => {
  reviveLocked = true;
  if (reviveChoices) {
    reviveChoices.replaceChildren();
    reviveChoices.style.display = "none";
  }
  if (reviveForm) reviveForm.style.display = "none";
  if (reviveError) reviveError.textContent = "";

  const lines = [`Correct answer: ${correctAnswer}`];
  if (explanation) lines.push("", `Explanation: ${explanation}`);
  if (reviveSolution) {
    reviveSolution.textContent = lines.join("\n");
    reviveSolution.style.display = "block";
  }
  if (continueBtn) continueBtn.style.display = "flex";
  if (reviveTip) reviveTip.textContent = "Tip: press Enter to continue (restart)";
};

const triggerHurtFlash = () => {
  if (!hurtFlash) return;
  hurtFlash.classList.remove("flash");
  // Force restart of the animation if hits occur close together.
  // eslint-disable-next-line no-unused-expressions
  hurtFlash.offsetWidth;
  hurtFlash.classList.add("flash");
};

const setMode = (nextMode) => {
  const prev = mode;
  mode = nextMode;
  if (mode === "menu") {
    menuOverlay.style.display = "flex";
    pauseOverlay.style.display = "none";
    restartOverlay.style.display = "none";
    document.getElementById("ui").style.display = "none";
    if (prev !== "menu") scheduleMenuDrift();
  } else if (mode === "playing") {
    menuOverlay.style.display = "none";
    pauseOverlay.style.display = "none";
    restartOverlay.style.display = "none";
    document.getElementById("ui").style.display = "flex";
    if (prev === "menu") clearMenuDrift();
    camera.position.copy(cameraBasePosition);
  } else if (mode === "paused") {
    menuOverlay.style.display = "none";
    pauseOverlay.style.display = "flex";
    restartOverlay.style.display = "none";
    document.getElementById("ui").style.display = "flex";
    if (prev === "menu") clearMenuDrift();
  } else if (mode === "gameover") {
    menuOverlay.style.display = "none";
    pauseOverlay.style.display = "none";
    restartOverlay.style.display = "flex";
    document.getElementById("ui").style.display = "flex";
    if (prev === "menu") clearMenuDrift();
    keys.clear();
    if (reviveError) reviveError.textContent = "";
    reviveLocked = false;
    activeQuestion = pickQuestion();
    renderReviveQuestion();
    if (deathHeadline) {
      deathHeadline.textContent =
        deathCause === "nuke" ? "You were blown up by a NUKE." : "You were overwhelmed by zombies.";
    }
    camera.position.copy(cameraBasePosition);
  } else if (mode === "nuking") {
    menuOverlay.style.display = "none";
    pauseOverlay.style.display = "none";
    restartOverlay.style.display = "none";
    document.getElementById("ui").style.display = "flex";
    if (prev === "menu") clearMenuDrift();
  }
};

const startGame = () => {
  resetGame();
  setMode("playing");
};

const goToMenu = () => {
  resetGame();
  setMode("menu");
};

const killAllZombies = () => {
  enemies.forEach((enemy) => scene.remove(enemy.sprite));
  enemies.length = 0;
};

const beginNukeSequence = () => {
  deathCause = "nuke";
  killAllZombies();
  keys.clear();
  playerVelocity.set(0, 0, 0);
  invulnTimer = 0;
  shieldTimer = 0;
  stunTimer = 0;
  hurtFlashTimer = 0;
  previousOverlaps = 0;

  nukePhase = "freeze";
  nukePhaseTimer = 0;
  camera.position.copy(cameraBasePosition);
  if (whiteout) {
    whiteout.style.display = "block";
    whiteout.style.opacity = "0";
  }
  setMode("nuking");
};

function attemptRevive(providedAnswer = null) {
  if (mode !== "gameover") return;
  if (reviveLocked) return;
  const userAnswer = normalizeAnswer(providedAnswer ?? reviveAnswer?.value);
  const correct = activeQuestion ? normalizeAnswer(activeQuestion.answer) : "1";
  if (userAnswer !== correct) {
    recordReviveAttempt({ questionId: activeQuestion?.id ?? null, correct: false });
    showReviveFailure(activeQuestion ? activeQuestion.answer : "1", activeQuestion?.explanation ?? "");
    return;
  }

  recordReviveAttempt({ questionId: activeQuestion?.id ?? null, correct: true });
  health = MAX_HEALTH;
  invulnTimer = 2;
  previousOverlaps = 0;
  hurtFlashTimer = 0;
  if (reviveError) reviveError.textContent = "";
  if (reviveAnswer) reviveAnswer.value = "";
  activeQuestion = null;
  deathCause = "zombies";
  if (whiteout) {
    whiteout.style.opacity = "0";
    setTimeout(() => {
      if (whiteout) whiteout.style.display = "none";
    }, 220);
  }
  setMode("playing");
}

const updateWalls = () => {
  tempVector.copy(player.position).sub(camera.position).normalize();
  raycaster.set(camera.position, tempVector);
  const hits = raycaster.intersectObjects(wallSegments, false);
  const faded = new Set(hits.map((hit) => hit.object));
  wallSegments.forEach((segment) => {
    segment.material.opacity = faded.has(segment) ? 0.2 : 1;
  });
};

const updatePlayer = (dt) => {
  const inputX =
    (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
  const inputZ = (keys.has("w") || keys.has("arrowup") ? 1 : 0) - (keys.has("s") || keys.has("arrowdown") ? 1 : 0);

  camera.getWorldDirection(cameraForward);
  cameraForward.y = 0;
  cameraForward.normalize();
  cameraRight.crossVectors(cameraForward, upVector).normalize();

  const move = tempVector.set(0, 0, 0);
  move.addScaledVector(cameraRight, inputX);
  move.addScaledVector(cameraForward, inputZ);

  const speedMult = adrenalineTimer > 0 ? POWERUP_SPEED_MULT : 1;
  const accel = ACCELERATION * speedMult;
  const maxSpeed = PLAYER_MAX_SPEED * speedMult;

  if (move.lengthSq() > 0) {
    move.normalize();
    playerVelocity.addScaledVector(move, accel * dt);
    const drag = Math.exp(-DRAG_WHEN_MOVING * dt);
    playerVelocity.multiplyScalar(drag);
  } else {
    const friction = Math.exp(-FRICTION_WHEN_STOPPING * dt);
    playerVelocity.multiplyScalar(friction);
  }
  const speed = playerVelocity.length();
  if (speed > maxSpeed) playerVelocity.multiplyScalar(maxSpeed / speed);

  player.position.addScaledVector(playerVelocity, dt);
  constrainToArena(player.position, playerVelocity, playerRadius);
};

const updatePowerups = (dt) => {
  if (adrenalineTimer > 0) adrenalineTimer = Math.max(0, adrenalineTimer - dt);
  if (shieldTimer > 0) shieldTimer = Math.max(0, shieldTimer - dt);
  if (stunTimer > 0) stunTimer = Math.max(0, stunTimer - dt);
  if (!powerups.length) return;

  const min = playerRadius + powerupRadius;
  for (let i = powerups.length - 1; i >= 0; i -= 1) {
    const p = powerups[i];
    const dx = p.sprite.position.x - player.position.x;
    const dz = p.sprite.position.z - player.position.z;
    if (dx * dx + dz * dz >= min * min) continue;

    if (p.type === "adrenaline") {
      adrenalineTimer = POWERUP_DURATION;
    } else if (p.type === "medkit") {
      health = Math.min(MAX_HEALTH, health + POWERUP_MEDKIT_HEAL);
    } else if (p.type === "shield") {
      shieldTimer = POWERUP_SHIELD_DURATION;
    } else if (p.type === "stun") {
      stunTimer = POWERUP_STUN_DURATION;
    } else if (p.type === "nuke") {
      beginNukeSequence();
    }

    scene.remove(p.sprite);
    powerups.splice(i, 1);
  }
};

const updateEnemies = (dt) => {
  if (stunTimer > 0) {
    enemies.forEach((enemy) => {
      const ease = 1 - Math.exp(-10 * dt);
      enemy.velocity.lerp(tempVectorA.set(0, 0, 0), ease);
    });
    return;
  }

  enemies.forEach((enemy) => {
    enemy.wanderTimer += dt;
    if (enemy.wanderTimer >= WANDER_INTERVAL) {
      enemy.wanderTimer = 0;
      enemy.wanderTarget = randomArenaPoint();
    }

    const toWander = tempVectorA.copy(enemy.wanderTarget).sub(enemy.sprite.position);
    let desired = toWander.lengthSq() > 0.0001 ? toWander.normalize() : tempVectorA.set(0, 0, 0);

    const toPlayer = tempVectorB.copy(player.position).sub(enemy.sprite.position);
    const distanceToPlayer = toPlayer.length();
    if (distanceToPlayer < HOMING_RADIUS) {
      desired = toPlayer.normalize();
    }

    const targetVelocity = desired.multiplyScalar(ENEMY_MAX_SPEED);
    const turn = 1 - Math.exp(-6 * dt);
    enemy.velocity.lerp(targetVelocity, turn);
    enemy.sprite.position.addScaledVector(enemy.velocity, dt);
    constrainToArena(enemy.sprite.position, enemy.velocity, enemyRadius);
  });
};

const updateSpawning = (dt) => {
  waveTimer += dt;
  if (waveTimer >= WAVE_INTERVAL) {
    waveTimer = 0;
    wave += 1;
    startWave();
  }

  if (spawnRemaining > 0) {
    spawnTimer += dt;
    if (spawnTimer >= WAVE_SPAWN_INTERVAL) {
      spawnTimer = 0;
      spawnRemaining -= 1;
      createEnemy();
    }
  }
};

const updateDamage = (dt) => {
  if (invulnTimer > 0 || shieldTimer > 0) {
    if (invulnTimer > 0) invulnTimer = Math.max(0, invulnTimer - dt);
    previousOverlaps = 0;
    hurtFlashTimer = 0;
    return;
  }

  let overlaps = 0;
  enemies.forEach((enemy) => {
    const dx = enemy.sprite.position.x - player.position.x;
    const dz = enemy.sprite.position.z - player.position.z;
    const distSq = dx * dx + dz * dz;
    const min = playerRadius + enemyRadius;
    if (distSq < min * min) {
      overlaps += 1;
    }
  });
  if (overlaps > 0) {
    // Strobe while continuously taking damage.
    hurtFlashTimer -= dt;
    if (hurtFlashTimer <= 0) {
      triggerHurtFlash();
      hurtFlashTimer = 0.16;
    }
    health -= DAMAGE_PER_SECOND * dt * overlaps;
    if (health <= 0 && mode !== "gameover") {
      deathCause = "zombies";
      setMode("gameover");
    }
  } else {
    hurtFlashTimer = 0;
  }
  previousOverlaps = overlaps;
};

const clock = new THREE.Clock();
const animate = () => {
  const dt = clock.getDelta();
  if (mode === "playing") {
    elapsed += dt;
    const sec = Math.floor(elapsed);
    if (sec !== lastBestSecond) {
      lastBestSecond = sec;
      updateBestScoreIfNeeded();
    }
    updatePlayer(dt);
    updateEnemies(dt);
    updateSpawning(dt);
    updatePowerups(dt);
    updateDamage(dt);
    updateUI();
  } else if (mode === "nuking") {
    // Freeze gameplay, run the nuke camera shake + whiteout.
    nukePhaseTimer += dt;

    if (nukePhase === "freeze") {
      camera.position.copy(cameraBasePosition);
      if (nukePhaseTimer >= NUKE_FREEZE_DURATION) {
        nukePhase = "shake";
        nukePhaseTimer = 0;
      }
    } else if (nukePhase === "shake") {
      const intensity = NUKE_SHAKE_INTENSITY;
      camera.position.copy(cameraBasePosition);
      camera.position.x += (Math.random() * 2 - 1) * intensity;
      camera.position.y += (Math.random() * 2 - 1) * intensity * 0.55;
      camera.position.z += (Math.random() * 2 - 1) * intensity;

      if (nukePhaseTimer >= NUKE_SHAKE_DURATION) {
        nukePhase = "fade";
        nukePhaseTimer = 0;
      }
    } else if (nukePhase === "fade") {
      const t = Math.min(1, nukePhaseTimer / NUKE_FADE_DURATION);
      const intensity = NUKE_SHAKE_INTENSITY * (1 - t) * 0.9;
      camera.position.copy(cameraBasePosition);
      camera.position.x += (Math.random() * 2 - 1) * intensity;
      camera.position.y += (Math.random() * 2 - 1) * intensity * 0.55;
      camera.position.z += (Math.random() * 2 - 1) * intensity;

      if (whiteout) whiteout.style.opacity = String(t);
      if (t >= 1) {
        // Fully white: now show the death/revive overlay with the correct message.
        camera.position.copy(cameraBasePosition);
        setMode("gameover");
      }
    }
  }
  if (mode !== "menu") {
    updateWalls();
  }
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
};

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys.add(key);
  if (key === "escape") {
    if (mode === "playing") {
      keys.clear();
      setMode("paused");
    } else if (mode === "paused") {
      setMode("playing");
    }
  }

  if (key === "r") {
    if (mode === "gameover") {
      startGame();
    } else if (mode === "paused") {
      startGame();
    }
  }

  if (key === "m" && mode === "paused") {
    keys.clear();
    goToMenu();
  }

  if (key === "enter" && mode === "gameover") {
    if (reviveLocked) startGame();
    else attemptRevive();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

window.addEventListener("blur", () => {
  keys.clear();
  if (mode === "playing") setMode("paused");
});

startBtn?.addEventListener("click", () => startGame());
resumeBtn?.addEventListener("click", () => setMode("playing"));
restartBtn?.addEventListener("click", () => startGame());
menuBtn?.addEventListener("click", () => goToMenu());
reviveBtn?.addEventListener("click", () => attemptRevive());
restartFromDeathBtn?.addEventListener("click", () => startGame());
continueRestartBtn?.addEventListener("click", () => startGame());
reviveAnswer?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    if (mode === "gameover" && reviveLocked) startGame();
    else attemptRevive();
  }
});

setMode("menu");
scheduleMenuDrift();
loadQuestions();
loadBestScore();
applyWaveColor();
updateUI();
animate();
