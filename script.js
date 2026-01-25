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

// 1. OPENING
document.getElementById('coin-btn').onclick = () => {
    document.getElementById('entry-screen').classList.add('open');
    setTimeout(() => {
        document.getElementById('entry-screen').style.display = 'none';
        startWebcam();
    }, 1500);
};

async function startWebcam() {
    try {
        const constraints = {
            video: { facingMode: "user" },
            audio: false
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
    } catch (err) { alert("Camera not accessible! Please check permissions."); }
}

// 2. FILTERS
document.querySelectorAll('.filter-item').forEach(item => {
    item.onclick = () => {
        document.querySelector('.filter-item.active').classList.remove('active');
        item.classList.add('active');
        video.style.filter = item.dataset.filter;
    };
});

// 3. STICKERS (Updated for Touch)
function addSticker(emoji) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sticker-wrapper';
    wrapper.style.left = '50px'; wrapper.style.top = '50px';
    wrapper.innerHTML = `<div class="handle rotate-handle"></div><span style="font-size:50px; display:block; user-select:none;">${emoji}</span><div class="handle resize-handle"></div>`;
    overlay.appendChild(wrapper);

    let rotation = 0; let size = 50;

    const getPointerPos = (e) => {
        const event = e.touches ? e.touches[0] : e;
        return { x: event.clientX, y: event.clientY };
    };

    const startDrag = (e) => {
        if (e.target.classList.contains('handle')) return;
        const pos = getPointerPos(e);
        let sx = pos.x - wrapper.offsetLeft, sy = pos.y - wrapper.offsetTop;

        const move = (ev) => {
            const now = getPointerPos(ev);
            wrapper.style.left = now.x - sx + 'px';
            wrapper.style.top = now.y - sy + 'px';
        };
        const stop = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('touchmove', move);
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('touchmove', move, { passive: false });
        document.addEventListener('mouseup', stop, { once: true });
        document.addEventListener('touchend', stop, { once: true });
    };

    wrapper.addEventListener('mousedown', startDrag);
    wrapper.addEventListener('touchstart', startDrag, { passive: false });

    // Rotate Logic
    wrapper.querySelector('.rotate-handle').addEventListener('touchstart', (e) => rotateHandler(e), { passive: false });
    wrapper.querySelector('.rotate-handle').onmousedown = (e) => rotateHandler(e);

    function rotateHandler(e) {
        e.stopPropagation(); e.preventDefault();
        const rotate = (ev) => {
            const p = getPointerPos(ev);
            const r = wrapper.getBoundingClientRect();
            rotation = Math.atan2(p.y - (r.top + r.height/2), p.x - (r.left + r.width/2)) * 180 / Math.PI + 90;
            wrapper.style.transform = `rotate(${rotation}deg)`;
        };
        document.addEventListener('mousemove', rotate);
        document.addEventListener('touchmove', rotate, { passive: false });
        document.addEventListener('mouseup', () => { document.removeEventListener('mousemove', rotate); }, { once: true });
        document.addEventListener('touchend', () => { document.removeEventListener('touchmove', rotate); }, { once: true });
    }

    // Resize Logic
    wrapper.querySelector('.resize-handle').addEventListener('touchstart', (e) => resizeHandler(e), { passive: false });
    wrapper.querySelector('.resize-handle').onmousedown = (e) => resizeHandler(e);

    function resizeHandler(e) {
        e.stopPropagation(); e.preventDefault();
        let startX = getPointerPos(e).x, startSize = size;
        const resize = (ev) => {
            size = Math.max(20, startSize + (getPointerPos(ev).x - startX));
            wrapper.querySelector('span').style.fontSize = size + 'px';
        };
        document.addEventListener('mousemove', resize);
        document.addEventListener('touchmove', resize, { passive: false });
        document.addEventListener('mouseup', () => { document.removeEventListener('mousemove', resize); }, { once: true });
        document.addEventListener('touchend', () => { document.removeEventListener('touchmove', resize); }, { once: true });
    }
}

// 4. PHOTO SESSION
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
    document.getElementById('start-btn').disabled = false;
};

function runCountdown() {
    return new Promise(res => {
        const el = document.getElementById('countdown');
        el.classList.remove('hidden');
        let c = 3; el.innerText = c;
        let t = setInterval(() => {
            c--;
            if (c > 0) el.innerText = c;
            else if (c === 0) el.innerText = "SMILE! 😊";
            else { clearInterval(t); el.classList.add('hidden'); res(); }
        }, 1000);
    });
}

function triggerFlash() {
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), 100);
}

function captureImage() {
    const tmp = document.createElement('canvas');
    tmp.width = video.videoWidth; tmp.height = video.videoHeight;
    const tctx = tmp.getContext('2d');
    tctx.filter = video.style.filter;
    tctx.drawImage(video, 0, 0);

    document.querySelectorAll('.sticker-wrapper').forEach(s => {
        const r = s.getBoundingClientRect(), b = boothBox.getBoundingClientRect();
        const x = (r.left - b.left + r.width/2) * (tmp.width/b.width);
        const y = (r.top - b.top + r.height/2) * (tmp.height/b.height);
        
        tctx.save();
        tctx.translate(x, y);
        const style = window.getComputedStyle(s).transform;
        if (style !== 'none') {
            const v = style.split('(')[1].split(')')[0].split(',');
            tctx.rotate(Math.atan2(v[1], v[0]));
        }
        const fSize = window.getComputedStyle(s.querySelector('span')).fontSize;
        tctx.font = `${parseInt(fSize) * (tmp.width/b.width)}px Arial`;
        tctx.textAlign = "center"; tctx.textBaseline = "middle"; tctx.filter = "none";
        tctx.fillText(s.querySelector('span').innerText, 0, 0);
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
    link.download = `my_strip_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
};
