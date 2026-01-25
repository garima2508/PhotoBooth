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
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
    } catch (err) { alert("Camera not accessible!"); }
}

// 2. FILTERS
document.querySelectorAll('.filter-item').forEach(item => {
    item.onclick = () => {
        document.querySelector('.filter-item.active').classList.remove('active');
        item.classList.add('active');
        video.style.filter = item.dataset.filter;
    };
});

// 3. STICKERS
function addSticker(emoji) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sticker-wrapper';
    wrapper.style.left = '50px'; wrapper.style.top = '50px';
    wrapper.innerHTML = `<div class="handle rotate-handle"></div><span style="font-size:50px; display:block; user-select:none;">${emoji}</span><div class="handle resize-handle"></div>`;
    overlay.appendChild(wrapper);

    let rotation = 0; let size = 50;
    wrapper.onmousedown = (e) => {
        if (e.target.classList.contains('handle')) return;
        let sx = e.clientX - wrapper.offsetLeft, sy = e.clientY - wrapper.offsetTop;
        document.onmousemove = (ev) => { wrapper.style.left = ev.clientX - sx + 'px'; wrapper.style.top = ev.clientY - sy + 'px'; };
        document.onmouseup = () => document.onmousemove = null;
    };
    wrapper.querySelector('.rotate-handle').onmousedown = (e) => {
        e.stopPropagation();
        document.onmousemove = (ev) => {
            const r = wrapper.getBoundingClientRect();
            rotation = Math.atan2(ev.clientY - (r.top + r.height/2), ev.clientX - (r.left + r.width/2)) * 180 / Math.PI + 90;
            wrapper.style.transform = `rotate(${rotation}deg)`;
        };
        document.onmouseup = () => document.onmousemove = null;
    };
    wrapper.querySelector('.resize-handle').onmousedown = (e) => {
        e.stopPropagation();
        let startX = e.clientX, startSize = size;
        document.onmousemove = (ev) => {
            size = Math.max(20, startSize + (ev.clientX - startX));
            wrapper.querySelector('span').style.fontSize = size + 'px';
        };
        document.onmouseup = () => document.onmousemove = null;
    };
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

    // Stop Webcam
    if (stream) stream.getTracks().forEach(t => t.stop());
    
    // Display Result
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

    // Draw Stickers on capture
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
    canvas.height = (h * 4) + (p * 5); // Spacing for 4 photos + margins
    
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    capturedFrames.forEach((frame, i) => {
        ctx.drawImage(frame, p, p + i * (h + p), w, h);
    });
}

// 5. BUTTONS
document.getElementById('retake-btn').onclick = () => location.reload();

document.getElementById('download-btn').onclick = () => {
    const link = document.createElement('a');
    link.download = `my_booth_strip_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
};