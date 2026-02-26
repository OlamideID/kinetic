// ─── Config ───────────────────────────────────────────────────
const WS_URL = 'ws://localhost:6789';
const CW = 160, CH = 220;
const HOVER_RADIUS = 115;
const LERP = 0.16;

const CARD_DATA = [
    { label: 'Image 1', img: 'assets/1.jpg' },
    { label: 'Image 2', img: 'assets/2.jpg' },
    { label: 'Image 3', img: 'assets/3.jpg' },
    { label: 'Image 4', img: 'assets/4.jpg' },
    { label: 'Image 5', img: 'assets/5.jpg' },
    { label: 'Image 6', img: 'assets/6.jpg' },
    { label: 'Image 7', img: 'assets/7.jpg' },
];

// ─── State ────────────────────────────────────────────────────
let vw = window.innerWidth, vh = window.innerHeight;
let targetX = vw / 2, targetY = vh / 2;
let curX = vw / 2, curY = vh / 2;

let gesture = 'open';
let prevGesture = 'open';
let hoveredIdx = -1;
let draggedIdx = -1;
let stackMode = false;
let stackOffsets = [];

// ─── Theme ───────────────────────────────────────────────────
let isDark = true;
document.getElementById('themeToggle').addEventListener('click', () => {
    isDark = !isDark;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.getElementById('themeToggle').textContent = isDark ? '☀️' : '🌙';
});

// ─── Build cards ─────────────────────────────────────────────
const stage = document.getElementById('stage');
const cardEls = [];
const cards = [];

function randomScatter() {
    const spreadX = vw * 0.30;
    const spreadY = vh * 0.22;
    const rx = (Math.random() + Math.random() - 1) * spreadX;
    const ry = (Math.random() + Math.random() - 1) * spreadY;
    return {
        rx: vw / 2 + rx,
        ry: vh / 2 + ry,
        rr: (Math.random() - 0.5) * 22,
    };
}

CARD_DATA.forEach((data, i) => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `
        <img src="${data.img}" alt="${data.label}">
        <div class="card-footer">
            <span class="card-label">${data.label}</span>
            <span class="card-num">0${i + 1}</span>
        </div>`;
    stage.appendChild(el);
    cardEls.push(el);

    const sc = randomScatter();
    cards.push({
        x: vw / 2, y: vh / 2,
        vx: 0, vy: 0,
        rot: 0, vrot: 0,
        restX: sc.rx, restY: sc.ry, restRot: sc.rr,
        dragOffX: 0, dragOffY: 0,
        zBase: i + 1,
        ready: false,
    });

    stackOffsets.push({ dx: 0, dy: 0 });

    setTimeout(() => { cards[i].ready = true; }, i * 110);
});

document.getElementById('cardCount').textContent = `${CARD_DATA.length} cards`;

// ─── DOM refs ─────────────────────────────────────────────────
const wsPip = document.getElementById('wsPip');
const wsLabel = document.getElementById('wsLabel');
const handPip = document.getElementById('handPip');
const handLbl = document.getElementById('handLabel');
const gestureEl = document.getElementById('gesture');
const offline = document.getElementById('offline');
const cursor = document.getElementById('cursor');

// ─── WebSocket ────────────────────────────────────────────────
function connectWS() {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        wsPip.className = 'pip ws-on';
        wsLabel.textContent = 'live';
        offline.classList.add('hidden');
    };

    ws.onmessage = ({ data }) => {
        const d = JSON.parse(data);
        if (d.detected) {
            targetX = d.x * vw;
            targetY = d.y * vh;
            gesture = d.gesture;
            handPip.className = 'pip hand-on';
            handLbl.textContent = gesture;
        } else {
            handPip.className = 'pip';
            handLbl.textContent = 'no hand';
        }
    };

    ws.onclose = () => {
        wsPip.className = 'pip';
        wsLabel.textContent = 'offline';
        setTimeout(connectWS, 2000);
    };

    ws.onerror = () => ws.close();
}

connectWS();

// ─── Mouse (always active) ────────────────────────────────────
document.addEventListener('mousemove', e => { targetX = e.clientX; targetY = e.clientY; });
document.addEventListener('mousedown', () => { gesture = 'closed'; });
document.addEventListener('mouseup', () => { gesture = 'open'; });
window.addEventListener('resize', () => { vw = window.innerWidth; vh = window.innerHeight; });

// ─── Helpers ─────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

function spring(cur, target, vel, k = 0.09, damp = 0.78) {
    const nv = (vel + (target - cur) * k) * damp;
    return { val: cur + nv, vel: nv };
}

function stackPos(i) {
    return {
        sx: (i - (cards.length - 1) / 2) * 2.5,
        sy: i * 1.2,
        sr: (i - (cards.length - 1) / 2) * 1.8,
    };
}

// ─── Main loop ────────────────────────────────────────────────
function tick() {
    curX = lerp(curX, targetX, LERP);
    curY = lerp(curY, targetY, LERP);
    cursor.style.left = curX + 'px';
    cursor.style.top = curY + 'px';

    const justClosed = gesture === 'closed' && prevGesture === 'open';
    const justOpened = gesture === 'open' && prevGesture === 'closed';

    // ── ON FIST CLOSE ──
    if (justClosed) {
        if (hoveredIdx !== -1) {
            draggedIdx = hoveredIdx;
            stackMode = false;
            cards[draggedIdx].dragOffX = cards[draggedIdx].x - curX;
            cards[draggedIdx].dragOffY = cards[draggedIdx].y - curY;
        } else {
            draggedIdx = -1;
            stackMode = true;
            cards.forEach((c, i) => {
                stackOffsets[i].dx = c.x - curX;
                stackOffsets[i].dy = c.y - curY;
            });
        }
    }

    // ── ON FIST OPEN ──
    if (justOpened) {
        if (draggedIdx !== -1) {
            cards[draggedIdx].restX = cards[draggedIdx].x;
            cards[draggedIdx].restY = cards[draggedIdx].y;
            cards[draggedIdx].restRot = 0;
        }
        draggedIdx = -1;
        stackMode = false;
    }

    prevGesture = gesture;

    // ── Hover ──
    if (gesture === 'open' && draggedIdx === -1) {
        let best = -1, bestD = HOVER_RADIUS;
        cards.forEach((c, i) => {
            const d = Math.hypot(c.x - curX, c.y - curY);
            if (d < bestD) { bestD = d; best = i; }
        });
        hoveredIdx = best;
    } else {
        hoveredIdx = -1;
    }

    // ── Cursor style ──
    cursor.className = gesture === 'closed' ? 'closed'
        : hoveredIdx !== -1 ? 'hover'
            : '';

    // ── Gesture label ──
    if (draggedIdx !== -1) {
        gestureEl.textContent = '✊  dragging card';
        gestureEl.className = 'closed';
    } else if (stackMode) {
        gestureEl.textContent = '✊  moving stack';
        gestureEl.className = 'closed';
    } else if (hoveredIdx !== -1) {
        gestureEl.textContent = '☝️  hover — fist to grab';
        gestureEl.className = 'open';
    } else {
        gestureEl.textContent = '✋  scattered';
        gestureEl.className = 'open';
    }

    // ── Animate cards ──
    cards.forEach((c, i) => {
        let tx, ty, tr;

        if (i === draggedIdx) {
            tx = curX + c.dragOffX;
            ty = curY + c.dragOffY;
            tr = 0;
        } else if (stackMode) {
            const sp = stackPos(i);
            tx = curX + sp.sx;
            ty = curY + sp.sy;
            tr = sp.sr;
        } else {
            tx = c.ready ? c.restX : vw / 2;
            ty = c.ready ? c.restY : vh / 2;
            tr = c.ready ? c.restRot : 0;
        }

        const rx = spring(c.x, tx, c.vx, 0.09, 0.78);
        const ry = spring(c.y, ty, c.vy, 0.09, 0.78);
        const rrot = spring(c.rot, tr, c.vrot, 0.09, 0.78);

        c.x = rx.val; c.vx = rx.vel;
        c.y = ry.val; c.vy = ry.vel;
        c.rot = rrot.val; c.vrot = rrot.vel;

        const isHov = i === hoveredIdx;
        const isDrag = i === draggedIdx;
        const isStack = stackMode && !isDrag;

        cardEls[i].classList.toggle('is-hover', isHov && !isDrag);
        cardEls[i].classList.toggle('is-drag', isDrag);
        cardEls[i].classList.toggle('is-stack', isStack);

        cardEls[i].style.zIndex = isDrag ? 999
            : isHov ? 500
                : isStack ? (cards.length - i)
                    : c.zBase;

        cardEls[i].style.transform =
            `translate(${c.x - CW / 2}px, ${c.y - CH / 2}px) rotate(${c.rot}deg)`;
    });

    requestAnimationFrame(tick);
}

tick();