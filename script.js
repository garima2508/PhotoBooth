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
        captureUI.classList.remove('hidden');
    }, 1500);
};

async function startWebcam() {
    try {
        const constraints = {
            video: { 
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
    } catch (err) { 
        alert("Camera not accessible! Please ensure you are on HTTPS and have granted permissions."); 
    }
}

// 2. FILTERS
document.querySelectorAll('.filter-item').forEach(item => {
    item.onclick = () => {
        document.querySelector('.filter-item.active').classList.remove('active');
        item.classList.add('active');
        video.style.filter = item.dataset.filter;
    };
});

// 3. STICKERS (Enhanced for all devices)
function addSticker(emoji) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sticker-wrapper';
    wrapper.style.left = '20%'; 
    wrapper.style.top = '20%';
    wrapper.innerHTML = `
        <div class="handle rotate-handle"></div>
        <span style="font-size:60px; display:block; user-select:none; line-height:1;">${emoji}</span>
        <div class="handle resize-handle"></div>
    `;
    overlay.appendChild(wrapper);

    let rotation = 0;
    let size = 60;

    const getPointerPos = (e) => {
        const event = e.touches ? e.touches[0] : e;
        return { x: event.clientX, y: event.clientY };
    };

    // Drag Logic
    const startDrag = (e) => {
        if (e.target.classList.contains('handle')) return;
        e.preventDefault();
        const pos = getPointerPos(e);
        let sx = pos.x - wrapper.offsetLeft;
        let sy = pos.y - wrapper.offsetTop;

        const move = (ev) => {
            const now = getPointerPos(ev);
            wrapper.style.left = (now.x - sx) + 'px';
            wrapper.style.top = (now.y - sy) + 'px';
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
    const rotateHandler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        const rotate = (ev) => {
            const p = getPointerPos(ev);
            const r = wrapper.getBoundingClientRect();
            const centerX = r.left + r.width / 2;
            const centerY = r.top + r.height / 2;
            rotation = Math.atan2(p.y - centerY, p.x - centerX) * 180 / Math.PI + 90;
            wrapper.style.transform = `rotate(${rotation}deg)`;
        };
        document.addEventListener('mousemove', rotate);
        document.addEventListener('touchmove', rotate, { passive: false });
        document.addEventListener('mouseup', () => { document.removeEventListener('mousemove', rotate); }, { once: true });
        document.addEventListener('touchend', () => { document.removeEventListener('touchmove', rotate); }, { once: true });
    };

    wrapper.querySelector('.rotate-handle').addEventListener('mousedown', rotateHandler);
    wrapper.querySelector('.rotate-handle').addEventListener('touchstart', rotateHandler, { passive: false });

    // Resize Logic
    const resizeHandler = (e) => {
        e.stopPropagation();
        e.preventDefault();
        let startX = getPointerPos(e).x;
        let startSize = size;
        const resize = (ev) => {
            const delta = getPointerPos(ev).x - startX;
            size = Math.max(30, startSize + delta);
            wrapper.querySelector('span').style.fontSize = size + 'px';
        };
        document.addEventListener('mousemove', resize);
        document.addEventListener('touchmove', resize, { passive: false });
        document.addEventListener('mouseup', () => { document.removeEventListener('mousemove', resize); }, { once: true });
        document.addEventListener('touchend', () => { document.removeEventListener('touchmove', resize); }, { once: true });
    };

    wrapper.querySelector('.resize-handle').addEventListener('mousedown', resizeHandler);
    wrapper.querySelector('.resize-handle').addEventListener('touchstart', resizeHandler, { passive: false });
}

// 4. PHOTO SESSION
document.getElementById('start-btn').onclick = async () => {
    capturedFrames = [];
    document.getElementById('start-btn').disabled = true;
    document.getElementById('start-btn').innerText = "GET READY...";

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
        el.innerText = c;
        let t = setInterval(() => {
            c--;
            if (c > 0) el.innerText = c;
            else if (c === 0) el.innerText = "SMILE! 😊";
            else { 
                clearInterval(t); 
                el.classList.add('hidden'); 
                res(); 
            }
        }, 1000);
    });
}

function triggerFlash() {
    flash.classList.remove('hidden');
    setTimeout(() => flash.classList.add('hidden'), 100);
}

function captureImage() {
    const tmp = document.createElement('canvas');
    // Use actual video resolution for high quality
    tmp.width = video.videoWidth; 
    tmp.height = video.videoHeight;
    const tctx = tmp.getContext('2d');
    
    // Apply Filter
    tctx.filter = getComputedStyle(video).filter;
    tctx.drawImage(video, 0, 0, tmp.width, tmp.height);

    // Render Stickers onto Canvas
    const b = boothBox.getBoundingClientRect();
    const scale = tmp.width / b.width;

    document.querySelectorAll('.sticker-wrapper').forEach(s => {
        const r = s.getBoundingClientRect();
        const span = s.querySelector('span');
        const fontSize = parseFloat(window.getComputedStyle(span).fontSize);
        
        // Calculate center of sticker relative to booth-box
        const centerX = (r.left - b.left + r.width / 2) * scale;
        const centerY = (r.top - b.top + r.height / 2) * scale;

        tctx.save();
        tctx.translate(centerX, centerY);
        
        // Handle Rotation
        const style = window.getComputedStyle(s).transform;
        if (style !== 'none') {
            const values = style.split('(')[1].split(')')[0].split(',');
            const angle = Math.atan2(values[1], values[0]);
            tctx.rotate(angle);
        }

        tctx.font = `${fontSize * scale}px Arial`;
        tctx.textAlign = "center";
        tctx.textBaseline = "middle";
        tctx.filter = "none"; // Stickers shouldn't have the photo filter
        tctx.fillText(span.innerText, 0, 0);
        tctx.restore();
    });
    
    capturedFrames.push(tmp);
}

function drawFinalStrip() {
    const w = 600; // High res width
    const h = 450; // High res height (4:3)
    const padding = 40;
    
    canvas.width = w + (padding * 2);
    canvas.height = (h * 4) + (padding * 5);
    
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    capturedFrames.forEach((frame, i) => {
        ctx.drawImage(frame, padding, padding + i * (h + padding), w, h);
    });
}

document.getElementById('retake-btn').onclick = () => location.reload();

document.getElementById('download-btn').onclick = () => {
    const link = document.createElement('a');
    link.download = `skyhigh_strip_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
};
