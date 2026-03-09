const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const focusBar = document.getElementById('focus-bar');
const focusScoreTxt = document.getElementById('focus-score');
const alertBox = document.getElementById('alert-message');
const logWindow = document.getElementById('log-window');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const focusAlarm = document.getElementById('focus-alarm');

let isTracking = false;
let camera = null;
let focusScore = 100;
let lastUpdate = performance.now();

// Modal elements
const scoreModal = document.getElementById('score-modal');
const finalTimeTxt = document.getElementById('final-time');
const finalAvgScoreTxt = document.getElementById('final-avg-score');
const modalFeedbackTxt = document.getElementById('modal-feedback');
const closeModalBtn = document.getElementById('close-modal-btn');

// Session Stats
let sessionStartTime = 0;
let scoreAccumulator = 0;
let scoreSampleCount = 0;
let currentDistraction = 'NONE';

// Camera Initialization Helper
async function enableCamera() {
    if (!camera) {
        camera = new Camera(videoElement, {
            onFrame: async () => {
                await faceMesh.send({ image: videoElement });
            },
            width: 1280,
            height: 720
        });
    }
    await camera.start();
}

function disableCamera() {
    if (camera && !isTracking) {
        camera.stop();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        statusDot.style.animation = 'none';
        statusText.textContent = 'SISTEMA EM ESPERA';
        statusText.style.color = '#f5f5f5';
        addLog('Câmera desativada.');
        
        if (focusAlarm && !focusAlarm.paused) {
            focusAlarm.pause();
            focusAlarm.currentTime = 0;
        }
    }
}

// Utility for logging messages to the HUD
function addLog(msg) {
    const p = document.createElement('p');
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: "numeric", minute: "numeric", second: "numeric" });
    p.textContent = `[${time}] > ${msg}`;
    logWindow.appendChild(p);
    logWindow.scrollTop = logWindow.scrollHeight;

    // Keep max 20 lines
    if (logWindow.children.length > 20) {
        logWindow.removeChild(logWindow.firstChild);
    }
}

// Function to update visuals based on focus score
function updateUI() {
    // Get interactive elements that will change color (must be defined first!)
    const videoWrapper = document.querySelector('.video-wrapper');
    const corners = document.querySelectorAll('.hud-corner');
    const crosshair = document.querySelector('.crosshair');

    // Se o rastreamento de foco não estiver ativo, não atualiza
    if (!isTracking) {
        // Volta pro neutro
        videoWrapper.style.borderColor = 'rgba(0, 191, 255, 0.3)';
        videoWrapper.style.boxShadow = 'inset 0 0 30px rgba(0, 191, 255, 0.05)';
        corners.forEach(c => { c.style.borderColor = 'rgba(0, 191, 255, 0.3)'; c.style.boxShadow = 'none'; });
        crosshair.style.borderColor = 'rgba(0, 191, 255, 0.3)';
        alertBox.className = 'alert-box';
        alertBox.textContent = 'SISTEMA EM ESPERA';
        alertBox.style.color = '#f5f5f5';
        alertBox.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        alertBox.style.textShadow = 'none';
        
        if (focusAlarm && !focusAlarm.paused) {
            focusAlarm.pause();
            focusAlarm.currentTime = 0;
        }
        return;
    }

    focusScore = Math.max(0, Math.min(100, focusScore));
    focusScoreTxt.textContent = `${Math.round(focusScore)}%`;
    focusBar.style.width = `${focusScore}%`;

    if (focusScore > 75) {
        // High focus - Ice Blue Default
        focusBar.style.backgroundColor = '#00bfff';
        focusBar.style.boxShadow = '0 0 15px #00bfff';
        alertBox.className = 'alert-box';
        alertBox.textContent = 'FOCO ESTÁVEL';
        alertBox.style.color = '#00bfff';
        alertBox.style.borderColor = 'rgba(0, 191, 255, 0.5)';
        alertBox.style.textShadow = '0 0 8px rgba(0, 191, 255, 0.5)';

        videoWrapper.style.borderColor = '#00bfff';
        videoWrapper.style.boxShadow = '0 0 20px rgba(0, 191, 255, 0.15), inset 0 0 30px rgba(0, 191, 255, 0.05)';
        corners.forEach(c => { c.style.borderColor = '#00bfff'; c.style.boxShadow = '0 0 10px rgba(0, 191, 255, 0.5)'; });
        crosshair.style.borderColor = 'rgba(0, 191, 255, 0.3)';
        
        if (focusAlarm && !focusAlarm.paused) {
            focusAlarm.pause();
            focusAlarm.currentTime = 0;
        }
    } else if (focusScore > 50) {
        // Medium Focus / Warning - Cyan
        focusBar.style.backgroundColor = '#00ffff';
        focusBar.style.boxShadow = '0 0 15px #00ffff';
        alertBox.className = 'alert-box warning';
        alertBox.textContent = currentDistraction === 'SLEEPING' ? 'AVISO: OLHOS FECHADOS' : 'DISTRAÇÃO DETECTADA';

        videoWrapper.style.borderColor = '#00ffff';
        videoWrapper.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.3), inset 0 0 30px rgba(0, 255, 255, 0.1)';
        corners.forEach(c => { c.style.borderColor = '#00ffff'; c.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.6)'; });
        crosshair.style.borderColor = 'rgba(0, 255, 255, 0.5)';
        
        if (focusAlarm && !focusAlarm.paused) {
            focusAlarm.pause();
            focusAlarm.currentTime = 0;
        }
    } else {
        // Danger / Critical - Red
        focusBar.style.backgroundColor = '#ff3333';
        focusBar.style.boxShadow = '0 0 20px #ff3333';
        alertBox.className = 'alert-box danger';
        alertBox.textContent = currentDistraction === 'SLEEPING' ? 'CRÍTICO: SUJEITO DORMINDO!' : 'FOCO CRÍTICO! RETORNE PARA A TELA';

        videoWrapper.style.borderColor = '#ff3333';
        videoWrapper.style.boxShadow = '0 0 30px rgba(255, 51, 51, 0.5), inset 0 0 40px rgba(255, 51, 51, 0.2)';
        corners.forEach(c => { c.style.borderColor = '#ff3333'; c.style.boxShadow = '0 0 20px rgba(255, 51, 51, 0.8)'; });
        crosshair.style.borderColor = 'rgba(255, 51, 51, 0.5)';
        
        if (focusAlarm && focusAlarm.paused) {
            focusAlarm.play().catch(e => console.log('Audio error:', e));
        }
    }
}

// Helper for Eye Aspect Ratio (EAR)
function getEAR(l, p0, p1, p2, p3, p4, p5) {
    const v1 = Math.hypot(l[p1].x - l[p5].x, l[p1].y - l[p5].y);
    const v2 = Math.hypot(l[p2].x - l[p4].x, l[p2].y - l[p4].y);
    const h = Math.hypot(l[p0].x - l[p3].x, l[p0].y - l[p3].y);
    return (v1 + v2) / (2.0 * h);
}

// Result callback from MediaPipe FaceMesh
function onResults(results) {
    if (!isTracking) return;

    // Ensure canvas dimensions match video
    if (canvasElement.width !== videoElement.videoWidth && videoElement.videoWidth > 0) {
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    currentDistraction = 'NONE';

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        // Usamos sempre a primeira face detectada
        const landmarks = results.multiFaceLandmarks[0];

        // Draw primary face
        canvasCtx.globalCompositeOperation = 'source-over';
        canvasCtx.lineWidth = 1;
        drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION,
            { color: 'rgba(0, 191, 255, 0.15)', lineWidth: 1 });

        // Highlighting important facial features
        drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, { color: '#00ffff', lineWidth: 1 });
        drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, { color: '#00ffff', lineWidth: 1 });
        drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, { color: '#00bfff', lineWidth: 1.5 });

        // Gaze and Posture Estimation logic
        // Use key points: nose tip, cheeks, and forehead
            // Only calculate focus score for the PRIORITY (first) face
            // Use key points: nose tip, cheeks, and forehead
            const nose = landmarks[1];
            const leftCheek = landmarks[234];
            const rightCheek = landmarks[454];
            const topForehead = landmarks[10];
            const chin = landmarks[152];

            // Calculate relative offset of nose from center of face to determine head rotation (yaw)
            const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
            const horizontalOffset = nose.x - faceCenterX;

            // Calculate relative offset of nose for pitch
            const faceCenterY = (topForehead.y + chin.y) / 2;
            const verticalOffset = nose.y - faceCenterY;

            // Calculate Eye Aspect Ratio to detect blinks/sleeping
            const leftEAR = getEAR(landmarks, 33, 159, 158, 133, 153, 145);
            const rightEAR = getEAR(landmarks, 362, 385, 386, 263, 374, 380);
            const avgEAR = (leftEAR + rightEAR) / 2;
            const isSleeping = avgEAR < 0.22;

            // Distraction threshold checks
            if (isSleeping) {
                currentDistraction = 'SLEEPING';
            } else if (Math.abs(horizontalOffset) > 0.04 || verticalOffset < -0.05 || verticalOffset > 0.06) {
                currentDistraction = 'LOOKING_AWAY';
            }

            if (currentDistraction !== 'NONE') {
                // Render red alert circle around face
                const ovalCenter = {
                    x: faceCenterX * canvasElement.width,
                    y: faceCenterY * canvasElement.height
                };
                const radiusX = Math.abs(rightCheek.x - leftCheek.x) * canvasElement.width * 0.7;

                canvasCtx.beginPath();
                canvasCtx.ellipse(ovalCenter.x, ovalCenter.y, radiusX, radiusX * 1.3, 0, 0, 2 * Math.PI);
                canvasCtx.strokeStyle = 'rgba(255, 51, 51, 0.8)';
                canvasCtx.lineWidth = 3;
                canvasCtx.setLineDash([15, 10]);
                canvasCtx.stroke();
                canvasCtx.setLineDash([]);
            } else {
                // Render cyan focus ring
                const ovalCenter = {
                    x: faceCenterX * canvasElement.width,
                    y: faceCenterY * canvasElement.height
                };
                const radius = Math.abs(rightCheek.x - leftCheek.x) * canvasElement.width * 0.6;
                const time = Date.now() / 500;

                // Ring 1
                canvasCtx.beginPath();
                canvasCtx.arc(ovalCenter.x, ovalCenter.y, radius, time % (Math.PI * 2), (time + Math.PI * 1.5) % (Math.PI * 2));
                canvasCtx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
                canvasCtx.lineWidth = 2;
                canvasCtx.stroke();

                // Ring 2 (counter-rotating)
                canvasCtx.beginPath();
                canvasCtx.arc(ovalCenter.x, ovalCenter.y, radius + 15, -time % (Math.PI * 2), (-time + Math.PI) % (Math.PI * 2));
                canvasCtx.strokeStyle = 'rgba(0, 191, 255, 0.4)';
                canvasCtx.lineWidth = 1;
                canvasCtx.stroke();
            }
    } else {
        // Face lost entirely = Distracted and ready for new face
        if (isTracking) {
            currentDistraction = 'MISSING';
        }
    }

    if (isTracking) {
        // Score Calculation based on delta time
        const now = performance.now();
        const dt = (now - lastUpdate) / 1000;
        lastUpdate = now;

        if (currentDistraction !== 'NONE') {
            focusScore -= 25 * dt; // Drops quickly when distracted
        } else {
            focusScore += 12 * dt; // Regenerates slowly when focused
        }

        // Clamp the realtime score so it NEVER exceeds 100
        focusScore = Math.max(0, Math.min(100, focusScore));

        // Accumulate for average
        scoreAccumulator += focusScore;
        scoreSampleCount++;
    }

    updateUI();
    canvasCtx.restore();
}

// Initialize FaceMesh from MediaPipe CDN
const faceMesh = new FaceMesh({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }
});
faceMesh.setOptions({
    maxNumFaces: 2, // Enable multi-face tracking for intruder alert
    refineLandmarks: true, // Enable for better eye and lip tracking
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
faceMesh.onResults(onResults);

// Event Listeners for Controls
startBtn.addEventListener('click', async () => {
    if (isTracking) return;

    addLog('Initating neural scan sequence...');
    startBtn.textContent = 'LOCALIZANDO...';
    startBtn.style.color = '#fff';
    startBtn.style.boxShadow = '0 0 20px #00bfff';

    try {
        await enableCamera();
        isTracking = true;
        
        lastUpdate = performance.now();
        sessionStartTime = Date.now();
        scoreAccumulator = 0;
        scoreSampleCount = 0;

        startBtn.textContent = 'RASTREAMENTO ATIVO';
        statusDot.style.animation = 'pulse 0.5s infinite';
        statusText.textContent = 'SISTEMA ATIVO';
        statusText.style.color = '#00ffff';
        addLog('Câmera conectada. Estabelecendo rastreamento frontal...');

    } catch (error) {
        addLog(`ERRO: ${error.message}`);
        startBtn.textContent = 'INICIAR RASTREAMENTO';
        startBtn.style.color = '#00bfff';
        startBtn.style.boxShadow = 'none';
        alert("Acesso à câmera negado ou dispositivo não encontrado.");
    }
});

stopBtn.addEventListener('click', () => {
    if (!isTracking) return;

    // Calculate final stats before resetting
    const sessionDurationMs = Date.now() - sessionStartTime;
    const sessionSeconds = Math.floor(sessionDurationMs / 1000);
    const mins = Math.floor(sessionSeconds / 60).toString().padStart(2, '0');
    const secs = (sessionSeconds % 60).toString().padStart(2, '0');

    const averageScore = scoreSampleCount > 0 ? Math.min(100, Math.round(scoreAccumulator / scoreSampleCount)) : 0;

    isTracking = false;

    startBtn.textContent = 'INICIAR RASTREAMENTO';
    startBtn.style.color = '#00bfff';
    startBtn.style.boxShadow = 'none';

    addLog('Rastreamento de foco abortado.');

    disableCamera();
    updateUI();

    // Show Modal
    finalTimeTxt.textContent = `${mins}:${secs}`;
    finalAvgScoreTxt.textContent = `${averageScore}%`;

    // Color code final score and message
    if (averageScore > 80) {
        finalAvgScoreTxt.style.color = '#00bfff';
        finalAvgScoreTxt.style.textShadow = '0 0 15px rgba(0, 191, 255, 0.8)';
        modalFeedbackTxt.textContent = "Excelente performance. O link neural permaneceu estável durante a sessão.";
        modalFeedbackTxt.style.borderLeftColor = '#00bfff';
    } else if (averageScore > 50) {
        finalAvgScoreTxt.style.color = '#00ffff';
        finalAvgScoreTxt.style.textShadow = '0 0 15px rgba(0, 255, 255, 0.8)';
        modalFeedbackTxt.textContent = "Níveis de foco aceitáveis, porém distrações detectadas. Treinamento recomendado.";
        modalFeedbackTxt.style.borderLeftColor = '#00ffff';
    } else {
        finalAvgScoreTxt.style.color = '#ff3333';
        finalAvgScoreTxt.style.textShadow = '0 0 15px rgba(255, 51, 51, 0.8)';
        modalFeedbackTxt.textContent = "Falha crítica de foco. O sujeito não conseguiu manter a atenção.";
        modalFeedbackTxt.style.borderLeftColor = '#ff3333';
    }

    scoreModal.classList.remove('hidden');

    focusScore = 100;
    updateUI();
});

closeModalBtn.addEventListener('click', () => {
    scoreModal.classList.add('hidden');
});

// Cursor Trail Logic (Minimalist)
const cursorCanvas = document.createElement('canvas');
cursorCanvas.id = 'cursor-canvas';
document.body.appendChild(cursorCanvas);
const ctxCursor = cursorCanvas.getContext('2d');
let dots = [];

function resizeCursorCanvas() {
    cursorCanvas.width = window.innerWidth;
    cursorCanvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCursorCanvas);
resizeCursorCanvas();

window.addEventListener('mousemove', (e) => {
    // Para resolver o "mouse indo pro lado contrário", garantimos que não haja transforações no CSS do canvas do cursor.
    // O problema pode estar acontecendo se o canvas do cursor estiver sendo afetado por `transform: scaleX(-1)` que foi aplicado à câmera/canvas de rostos em index.css.
    // Confirmando captura correta de Coodenadas
    dots.push({ x: e.clientX, y: e.clientY, age: 0 });
});

function animateCursor() {
    ctxCursor.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);

    // Atualiza idade e remove velhos
    for (let i = 0; i < dots.length; i++) {
        dots[i].age++;
    }
    dots = dots.filter(d => d.age < 20);

    // Desenha rastro
    if (dots.length > 1) {
        ctxCursor.beginPath();
        ctxCursor.moveTo(dots[0].x, dots[0].y);
        for (let i = 1; i < dots.length; i++) {
            ctxCursor.lineTo(dots[i].x, dots[i].y);
        }
        ctxCursor.strokeStyle = 'rgba(0, 191, 255, 0.5)';
        ctxCursor.lineWidth = 2;
        ctxCursor.lineCap = 'round';
        ctxCursor.lineJoin = 'round';
        ctxCursor.stroke();
    }

    requestAnimationFrame(animateCursor);
}
animateCursor();

// Initial boot logs
setTimeout(() => addLog('Carregando definições da Neural Network FaceMesh...'), 500);
setTimeout(() => addLog('Definições Carregadas. Pronto para iniciar.'), 1500);
