const video = document.getElementById('webcam');
const boothBox = document.getElementById('booth-box');
const overlay = document.getElementById('sticker-overlay');
const canvas = document.getElementById('strip-canvas');
const ctx = canvas.getContext('2d');
const captureUI = document.getElementById('capture-ui');
const resultArea = document.getElementById('result-area');
const flash = document.getElementById('flash');

let stream = null;
let capturedFrames = [];

// 1. STARTUP
document.getElementById('coin-btn').onclick = () => {
    document.getElementById('entry-screen').classList.add('open');
    setTimeout(() => {
        document.getElementById('entry-screen').style.display = 'none';
        startWebcam();
        captureUI.classList.remove('hidden');
    }, 1500);
};

async function startWebcam() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user", aspectRatio: 4/3 }, 
            audio: false 
        });
        video.srcObject = stream;
    } catch (err) { alert("Camera error. Please ensure you allow permissions."); }
}

// 2. FILTERS
document.querySelectorAll('.filter-item').forEach(item => {
    item.onclick = () => {
        document.querySelector('.filter-item.active').classList.remove('active');
        item.classList.add('active');
        video.style.filter = item.dataset.filter;
    };
});

// 3. STICKERS (Responsive Math)
function addSticker(emoji) {
    const el = document.createElement('div');
    el.className = 'sticker-wrapper';
    el.style.left = '40%'; el.style.top = '40%';
    el.innerHTML = `
        <div class="handle rotate-handle"></div>
        <span style="font-size:50px;">${emoji}</span>
        <div class="handle resize-handle"></div>
    `;
    overlay.appendChild(el);

    let rotation = 0;
    let size = 50;

    const getPos = (e) => {
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX, y: t.clientY };
    };

    // DRAG
    const onMouseDown = (e) => {
        if (e.target.classList.contains('handle')) return;
        const start = getPos(e);
        const startL = el.offsetLeft;
        const startT = el.offsetTop;

        const onMouseMove = (ev) => {
            const now = getPos(ev);
            el.style.left = (startL + (now.x - start.x)) + 'px';
            el.style.top = (startT + (now.y - start.y)) + 'px';
        };
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('touchmove', onMouseMove, {passive: false});
        document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('touchmove', onMouseMove);
        }, {once: true});
        document.addEventListener('touchend', () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('touchmove', onMouseMove);
        }, {once: true});
    };

    el.addEventListener('mousedown', onMouseDown);
    el.addEventListener('touchstart', onMouseDown, {passive: false});

    // ROTATE
    const rotateBtn = el.querySelector('.rotate-handle');
    const rotateStart = (e) => {
        e.stopPropagation(); e.preventDefault();
        const move = (ev) => {
            const p = getPos(ev);
            const rect = el.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            rotation = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI + 90;
            el.style.transform = `rotate(${rotation}deg)`;
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('touchmove', move, {passive: false});
        document.addEventListener('mouseup', () => document.removeEventListener('mousemove', move), {once: true});
        document.addEventListener('touchend', () => document.removeEventListener('touchmove', move), {once: true});
    };
    rotateBtn.addEventListener('mousedown', rotateStart);
    rotateBtn.addEventListener('touchstart', rotateStart, {passive: false});

    // RESIZE
    const resizeBtn = el.querySelector('.resize-handle');
    const resizeStart = (e) => {
        e.stopPropagation(); e.preventDefault();
        const startX = getPos(e).x;
        const startSize = size;
        const move = (ev) => {
            size = Math.max(20, startSize + (getPos(ev).x - startX));
            el.querySelector('span').style.fontSize = size + 'px';
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('touchmove', move, {passive: false});
        document.addEventListener('mouseup', () => document.removeEventListener('mousemove', move), {once: true});
        document.addEventListener('touchend', () => document.removeEventListener('touchmove', move), {once: true});
    };
    resizeBtn.addEventListener('mousedown', resizeStart);
    resizeBtn.addEventListener('touchstart', resizeStart, {passive: false});
}

// 4. CAPTURE LOGIC
document.getElementById('start-btn').onclick = async () => {
    capturedFrames = [];
    document.getElementById('start-btn').disabled = true;

    for (let i = 0; i < 4; i++) {
        await runCountdown();
        captureImage();
        triggerFlash();
    }

    if (stream) stream.getTracks().forEach(t => t.stop());
    drawFinalStrip();
    captureUI.classList.add('hidden');
    resultArea.classList.remove('hidden');
};

function runCountdown() {
    return new Promise(res => {
        const el = document.getElementById('countdown');
        el.classList.remove('hidden');
        let c = 3;
        const timer = setInterval(() => {
            el.innerText = c > 0 ? c : "SMILE!";
            if (c < 0) { clearInterval(timer); el.classList.add('hidden'); res(); }
            c--;
        }, 800);
    });
}

function triggerFlash() {
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), 100);
}

function captureImage() {
    const tmp = document.createElement('canvas');
    tmp.width = 800; tmp.height = 600; // Standardize capture size
    const tctx = tmp.getContext('2d');
    
    // 1. Draw Mirror Video
    tctx.save();
    tctx.translate(tmp.width, 0);
    tctx.scale(-1, 1);
    tctx.filter = getComputedStyle(video).filter;
    tctx.drawImage(video, 0, 0, tmp.width, tmp.height);
    tctx.restore();

    // 2. Map Stickers
    const box = boothBox.getBoundingClientRect();
    const scale = tmp.width / box.width;

    document.querySelectorAll('.sticker-wrapper').forEach(s => {
        const sRect = s.getBoundingClientRect();
        const span = s.querySelector('span');
        const fSize = parseFloat(getComputedStyle(span).fontSize);
        
        // Calculate center relative to boothBox
        const cx = (sRect.left - box.left + sRect.width / 2) * scale;
        const cy = (sRect.top - box.top + sRect.height / 2) * scale;

        tctx.save();
        tctx.translate(cx, cy);
        
        // Match rotation
        const st = window.getComputedStyle(s).transform;
        if (st !== 'none') {
            const v = st.split('(')[1].split(')')[0].split(',');
            tctx.rotate(Math.atan2(v[1], v[0]));
        }

        tctx.font = `${fSize * scale}px Arial`;
        tctx.textAlign = "center";
        tctx.textBaseline = "middle";
        tctx.filter = "none";
        tctx.fillText(span.innerText, 0, 0);
        tctx.restore();
    });

    capturedFrames.push(tmp);
}

function drawFinalStrip() {
    const w = 400, h = 300, p = 30;
    canvas.width = w + p*2;
    canvas.height = (h * 4) + (p * 5);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    capturedFrames.forEach((frame, i) => {
        ctx.drawImage(frame, p, p + i * (h + p), w, h);
    });
}

document.getElementById('retake-btn').onclick = () => location.reload();
document.getElementById('download-btn').onclick = () => {
    const link = document.createElement('a');
    link.download = `booth_${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
};
