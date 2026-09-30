const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');
const distanceEl = document.getElementById('distance');
const finalScoreEl = document.getElementById('final-score');
const finalDistanceEl = document.getElementById('final-distance');

// Game states
const STATE_START = 0;
const STATE_PLAYING = 1;
const STATE_GAMEOVER = 2;
let gameState = STATE_START;

// Road specifications
const road = {
    x: 150,
    width: 500,
    leftBoundary() { return this.x; },
    rightBoundary() { return this.x + this.width; }
};

// Player Car
const player = {
    x: 370,
    y: 450,
    width: 50,
    height: 90,
    speed: 0,
    maxSpeed: 12,
    acceleration: 0.2,
    friction: 0.1,
    steerSpeed: 6,
    color: '#ff3333'
};

// Input tracking
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    KeyA: false,
    KeyD: false,
    KeyW: false,
    KeyS: false
};

// Game metrics
let score = 0;
let distance = 0;
let gameSpeed = 5;
let obstacles = [];
let particles = [];
let scenery = [];
let spawnTimer = 0;
let lineOffset = 0;

// Initialize scenery (trees/bushes on sides)
for (let i = 0; i < 20; i++) {
    scenery.push({
        y: i * 70 - 100,
        leftSide: Math.random() < 0.5,
        offset: Math.random() * 100,
        type: Math.random() < 0.5 ? 'tree' : 'rock'
    });
}

// Event Listeners
window.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = true;
        if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) {
            e.preventDefault();
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code)) {
        keys[e.code] = false;
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function startGame() {
    gameState = STATE_PLAYING;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    
    // Reset stats
    score = 0;
    distance = 0;
    gameSpeed = 6;
    player.x = 370;
    player.y = 450;
    player.speed = 0;
    obstacles = [];
    particles = [];
    spawnTimer = 0;
}

function gameOver() {
    gameState = STATE_GAMEOVER;
    finalScoreEl.innerText = Math.floor(score);
    finalDistanceEl.innerText = Math.floor(distance);
    gameOverScreen.classList.remove('hidden');
    
    // Crash explosion particles
    for(let i=0; i<40; i++) {
        particles.push({
            x: player.x + player.width/2,
            y: player.y + player.height/2,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            radius: Math.random() * 6 + 2,
            color: Math.random() < 0.5 ? '#ff3300' : '#ffcc00',
            life: 40
        });
    }
}

function update() {
    if (gameState !== STATE_PLAYING) return;

    // Acceleration / Deceleration
    if (keys.ArrowUp || keys.KeyW) {
        player.speed += player.acceleration;
        if (player.speed > player.maxSpeed) player.speed = player.maxSpeed;
    } else if (keys.ArrowDown || keys.KeyS) {
        player.speed -= player.acceleration * 1.5;
        if (player.speed < 0) player.speed = 0;
    } else {
        player.speed -= player.friction;
        if (player.speed < 0) player.speed = 0;
    }

    // Steering
    if (keys.ArrowLeft || keys.KeyA) {
        player.x -= player.steerSpeed * (player.speed / player.maxSpeed + 0.3);
    }
    if (keys.ArrowRight || keys.KeyD) {
        player.x += player.steerSpeed * (player.speed / player.maxSpeed + 0.3);
    }

    // Road boundary constraint
    if (player.x < road.leftBoundary() + 10) {
        player.x = road.leftBoundary() + 10;
        player.speed *= 0.95; // Slow down on grass/edge
    }
    if (player.x + player.width > road.rightBoundary() - 10) {
        player.x = road.rightBoundary() - 10 - player.width;
        player.speed *= 0.95;
    }

    // Update distance and score
    gameSpeed = 4 + player.speed;
    distance += gameSpeed * 0.1;
    score += gameSpeed * 0.05;

    // Animate road lines
    lineOffset += gameSpeed;
    if (lineOffset >= 60) lineOffset = 0;

    // Update scenery
    scenery.forEach(s => {
        s.y += gameSpeed;
        if (s.y > canvas.height) {
            s.y = -100;
            s.leftSide = Math.random() < 0.5;
            s.offset = Math.random() * 120;
        }
    });

    // Spawn obstacles (traffic cars)
    spawnTimer++;
    if (spawnTimer > Math.max(30, 90 - Math.floor(distance / 200))) {
        spawnTimer = 0;
        const laneWidth = road.width / 3;
        const lane = Math.floor(Math.random() * 3);
        const obsX = road.x + lane * laneWidth + laneWidth / 2 - 22;
        
        const colors = ['#3333ff', '#33cc33', '#cc33cc', '#ff9900', '#ffffff'];
        const obsColor = colors[Math.floor(Math.random() * colors.length)];
        
        obstacles.push({
            x: obsX,
            y: -120,
            width: 45,
            height: 85,
            speed: 2 + Math.random() * 3,
            color: obsColor
        });
    }

    // Update obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.y += gameSpeed - obs.speed;

        // Collision detection (AABB)
        if (
            player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y
        ) {
            gameOver();
        }

        // Remove off-screen obstacles
        if (obs.y > canvas.height + 100) {
            obstacles.splice(i, 1);
            score += 100; // Bonus for dodging
        }
    }

    // Update tire skid particles if turning sharply or braking
    if (player.speed > 3 && (keys.ArrowLeft || keys.KeyA || keys.ArrowRight || keys.KeyD)) {
        particles.push({
            x: player.x + (keys.ArrowLeft || keys.KeyA ? 10 : player.width - 10),
            y: player.y + player.height - 10,
            vx: (Math.random() - 0.5) * 0.5,
            vy: gameSpeed * 0.5,
            radius: 2,
            color: '#666',
            life: 20
        });
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }

    // HUD updates
    scoreEl.innerText = Math.floor(score);
    speedEl.innerText = Math.floor(player.speed * 15);
    distanceEl.innerText = Math.floor(distance);
}

function drawCar(x, y, width, height, color, isPlayer = false) {
    ctx.save();
    
    // Car Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.fill();

    // Windshield
    ctx.fillStyle = '#111';
    if (isPlayer) {
        ctx.fillRect(x + 8, y + 22, width - 16, 20);
        // Rear window
        ctx.fillRect(x + 10, y + 60, width - 20, 10);
    } else {
        // Opponent car facing down towards player view
        ctx.fillRect(x + 8, y + 48, width - 16, 20);
        ctx.fillRect(x + 10, y + 20, width - 20, 10);
    }

    // Wheels
    ctx.fillStyle = '#000';
    const wheelWidth = 10;
    const wheelHeight = 20;
    // Top left/right
    ctx.fillRect(x - 6, y + 12, wheelWidth, wheelHeight);
    ctx.fillRect(x + width - 4, y + 12, wheelWidth, wheelHeight);
    // Bottom left/right
    ctx.fillRect(x - 6, y + height - 32, wheelWidth, wheelHeight);
    ctx.fillRect(x + width - 4, y + height - 32, wheelWidth, wheelHeight);

    // Headlights / Taillights
    if (isPlayer) {
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(x + 4, y, 8, 4);
        ctx.fillRect(x + width - 12, y, 8, 4);
    } else {
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x + 4, y + height - 4, 8, 4);
        ctx.fillRect(x + width - 12, y + height - 4, 8, 4);
    }

    ctx.restore();
}

function draw() {
    // Clear background (grass)
    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Road
    ctx.fillStyle = '#495057';
    ctx.fillRect(road.x, 0, road.width, canvas.height);

    // Road shoulders (rumble strips)
    const stripWidth = 15;
    ctx.fillStyle = '#adb5bd';
    ctx.fillRect(road.x - stripWidth, 0, stripWidth, canvas.height);
    ctx.fillRect(road.rightBoundary(), 0, stripWidth, canvas.height);

    // Draw lane dividers (dashed lines)
    ctx.strokeStyle = '#f8f9fa';
    ctx.lineWidth = 6;
    ctx.setLineDash([30, 30]);
    ctx.lineDashOffset = -lineOffset;

    const laneWidth = road.width / 3;
    for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(road.x + i * laneWidth, 0);
        ctx.lineTo(road.x + i * laneWidth, canvas.height);
        ctx.stroke();
    }
    ctx.setLineDash([]); // Reset dash

    // Draw Scenery (trees / rocks)
    scenery.forEach(s => {
        const sx = s.leftSide ? road.x - 40 - s.offset : road.rightBoundary() + 30 + s.offset;
        if (s.type === 'tree') {
            ctx.fillStyle = '#1b4332';
            ctx.beginPath();
            ctx.arc(sx, s.y, 22, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#5c4033';
            ctx.fillRect(sx - 4, s.y + 10, 8, 20);
        } else {
            ctx.fillStyle = '#6c757d';
            ctx.beginPath();
            ctx.ellipse(sx, s.y, 16, 12, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Draw Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Obstacles
    obstacles.forEach(obs => {
        drawCar(obs.x, obs.y, obs.width, obs.height, obs.color, false);
    });

    // Draw Player
    if (gameState === STATE_PLAYING || gameState === STATE_START) {
        drawCar(player.x, player.y, player.width, player.height, player.color, true);
    }
}

// Main Game Loop
function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Initial draw to render screen before start
draw();
requestAnimationFrame(gameLoop);
