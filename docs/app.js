// DOM Elements
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const valSpeed = document.getElementById('val-speed');
const valSteering = document.getElementById('val-steering');
const valThrottle = document.getElementById('val-throttle');
const barSpeed = document.getElementById('bar-speed');
const barThrottle = document.getElementById('bar-throttle');
const visualWheel = document.getElementById('visual-wheel');
const sensorBarsContainer = document.getElementById('sensor-bars');

const btnRestart = document.getElementById('btn-restart');
const btnChangeTrack = document.getElementById('btn-change-track');
const modeManual = document.getElementById('mode-manual');
const modeAutonomous = document.getElementById('mode-autonomous');
const labelAutonomous = document.getElementById('label-autonomous');
const paramSpeed = document.getElementById('param-speed');
const valMaxSpeed = document.getElementById('val-max-speed');

// Canvas Setup
const simCanvas = document.getElementById('simCanvas');
const simCtx = simCanvas.getContext('2d');
const modelInputCanvas = document.getElementById('modelInputCanvas');

// Offscreen Canvas for virtual camera rendering
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');

// Configure canvas dimensions
simCanvas.width = 800;
simCanvas.height = 600;
offscreenCanvas.width = 800;
offscreenCanvas.height = 600;

// Application State
let model = null;
let isModelLoaded = false;
let controlMode = 'manual'; // 'manual' or 'autonomous'
let animationFrameId = null;

// Initialize Track and Car
const track = new Track();
const car = new Car(150, 420, track); // Initial starting position on the road

// Draw the track once onto the offscreen canvas (road texture source)
track.draw(offscreenCtx, true);

// Create Sensor UI Readouts
function initSensorUI() {
    sensorBarsContainer.innerHTML = '';
    for (let i = 0; i < car.sensor.rayCount; i++) {
        const row = document.createElement('div');
        row.className = 'sensor-row';
        row.innerHTML = `
            <span class="sensor-label">S${i+1}</span>
            <div class="sensor-track-container">
                <div class="sensor-track-bar" id="sensor-bar-${i}" style="width: 100%"></div>
            </div>
        `;
        sensorBarsContainer.appendChild(row);
    }
}
initSensorUI();

// Load TensorFlow.js model
async function loadAIModel() {
    try {
        statusText.innerText = 'Loading Model...';
        // Load LayersModel from converted model
        model = await tf.loadLayersModel('model_tfjs/model.json');
        isModelLoaded = true;
        
        statusDot.className = 'status-dot ready';
        statusText.innerText = 'AI Engine Ready';
        labelAutonomous.classList.remove('disabled');
        console.log('TensorFlow.js model loaded successfully!');
    } catch (err) {
        console.error('Failed to load TensorFlow.js model:', err);
        statusText.innerText = 'Model Missing (Running manual-only)';
        statusDot.style.backgroundColor = '#f39c12';
        statusDot.classList.remove('pulsing');
        labelAutonomous.classList.add('disabled');
        modeManual.checked = true;
    }
}

// Keyboard controls handler
window.addEventListener('keydown', (e) => {
    if (controlMode !== 'manual') return;
    
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            car.controls.forward = true;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            car.controls.reverse = true;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            car.controls.left = true;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            car.controls.right = true;
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
            car.controls.forward = false;
            break;
        case 'ArrowDown':
        case 's':
        case 'S':
            car.controls.reverse = false;
            break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
            car.controls.left = false;
            break;
        case 'ArrowRight':
        case 'd':
        case 'D':
            car.controls.right = false;
            break;
    }
});

// Event Listeners for UI
btnRestart.addEventListener('click', () => {
    car.x = 150;
    car.y = 420;
    car.angle = Math.PI * 1.5;
    car.speed = 0;
    car.controls.forward = false;
    car.controls.reverse = false;
    car.controls.left = false;
    car.controls.right = false;
});

btnChangeTrack.addEventListener('click', () => {
    // Switch to a new track geometry (e.g. alternate shape)
    // We can swap points and redraw offscreen canvas
    const p = track.points;
    // Simple vertical flip for a new track experience
    track.points = p.map(pt => ({x: pt.x, y: 600 - pt.y}));
    
    // Clear and redraw offscreen road
    offscreenCtx.fillStyle = '#121319';
    offscreenCtx.fillRect(0, 0, 800, 600);
    track.draw(offscreenCtx, true);
    
    // Reset car
    btnRestart.click();
});

document.querySelectorAll('input[name="control-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        controlMode = e.target.value;
        if (controlMode === 'manual') {
            car.controls.forward = false;
            car.controls.reverse = false;
            car.controls.left = false;
            car.controls.right = false;
        }
    });
});

paramSpeed.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value).toFixed(1);
    valMaxSpeed.innerText = val;
    car.maxSpeed = parseFloat(val);
});

// Preprocess frame using TFJS and run inference
async function runAIInference() {
    if (!isModelLoaded || !model) return;

    // Run in a tf.tidy block to clean up tensors automatically
    const steeringPrediction = tf.tidy(() => {
        // Convert input canvas pixels to tensor [66, 200, 3]
        const rgb = tf.browser.fromPixels(modelInputCanvas).toFloat();

        // Convert to YUV color space:
        // Y = 0.299 * R + 0.587 * G + 0.114 * B
        // U = -0.14713 * R - 0.28886 * G + 0.436 * B
        // V = 0.615 * R - 0.51499 * G - 0.10001 * B
        const r = rgb.slice([0, 0, 0], [-1, -1, 1]);
        const g = rgb.slice([0, 0, 1], [-1, -1, 1]);
        const b = rgb.slice([0, 0, 2], [-1, -1, 1]);

        const y = r.mul(0.299).add(g.mul(0.587)).add(b.mul(0.114));
        const u = r.mul(-0.14713).add(g.mul(-0.28886)).add(b.mul(0.436));
        const v = r.mul(0.615).add(g.mul(-0.51499)).add(b.mul(-0.10001));

        const yuv = tf.concat([y, u, v], 2);
        
        // Normalize 0-255 to 0-1
        const normalized = yuv.div(255.0);
        
        // Add batch dimension: [1, 66, 200, 3]
        const batched = normalized.expandDims(0);

        // Run prediction
        const output = model.predict(batched);
        
        // Get scalar prediction value
        return output.dataSync()[0];
    });

    // Translate prediction value (-1.0 to 1.0) into car controls
    // Multiply by scaling factor to get responsive steering
    const steeringFactor = 0.4; // adjusts sensitivity
    const angle = steeringPrediction * steeringFactor;

    // Apply smooth driving logic
    car.controls.forward = true;
    car.controls.reverse = false;
    
    // Convert to left/right control boolean commands
    if (angle < -0.05) {
        car.controls.left = true;
        car.controls.right = false;
    } else if (angle > 0.05) {
        car.controls.right = true;
        car.controls.left = false;
    } else {
        car.controls.left = false;
        car.controls.right = false;
    }

    // Dynamic speed throttle based on steering sharpness
    const speedLimit = car.maxSpeed;
    const speedTarget = speedLimit * (1.0 - Math.min(Math.abs(steeringPrediction), 0.7));
    if (car.speed > speedTarget) {
        car.controls.forward = false; // brake/coast
    }

    // Return raw predicted value to show on steering gauge
    return steeringPrediction;
}

// Main Animation Loop
async function tick() {
    // 1. Update Physics
    car.update();

    // 2. Draw Simulation Arena
    simCtx.fillStyle = '#121319';
    simCtx.fillRect(0, 0, simCanvas.width, simCanvas.height);
    
    // Draw track layout
    track.draw(simCtx);
    
    // Draw boundaries debug check (optional, here visual only)
    const boundaries = track.getBoundaries();
    simCtx.beginPath();
    simCtx.strokeStyle = 'rgba(255, 0, 0, 0.05)';
    simCtx.lineWidth = 2;
    boundaries.outer.forEach((p, idx) => {
        if (idx === 0) simCtx.moveTo(p.x, p.y);
        else simCtx.lineTo(p.x, p.y);
    });
    simCtx.closePath();
    simCtx.stroke();

    // Draw car
    car.draw(simCtx);

    // 3. Update Camera perspective and copy to model input canvas
    car.captureCamera(offscreenCanvas, modelInputCanvas);

    // 4. Handle controls & AI Inference
    let currentSteering = 0;
    if (controlMode === 'autonomous') {
        currentSteering = await runAIInference();
    } else {
        // Manual steering visual representation
        if (car.controls.left) currentSteering = -1;
        if (car.controls.right) currentSteering = 1;
    }

    // 5. Update Telemetry UI Displays
    updateTelemetryUI(currentSteering);

    animationFrameId = requestAnimationFrame(tick);
}

// Update Telemetry Panel UI widgets
function updateTelemetryUI(steeringVal) {
    // Speed
    const speedDisplay = (car.speed * 4.5).toFixed(1);
    valSpeed.innerHTML = `${speedDisplay} <span class="unit">mph</span>`;
    const speedPercent = Math.min((car.speed / car.maxSpeed) * 100, 100);
    barSpeed.style.width = `${speedPercent}%`;

    // Steering Angle
    const angleDeg = (steeringVal * 25).toFixed(1);
    valSteering.innerText = `${angleDeg > 0 ? '+' : ''}${angleDeg}°`;
    
    // Rotate Steering Wheel Gauge
    visualWheel.style.transform = `rotate(${steeringVal * 90}deg)`;

    // Throttle
    const throttleVal = car.controls.forward ? (1 - (car.speed / car.maxSpeed) * 0.3) : 0;
    valThrottle.innerText = throttleVal.toFixed(2);
    barThrottle.style.width = `${throttleVal * 100}%`;

    // Sensor Readings
    for (let i = 0; i < car.sensor.rayCount; i++) {
        const barEl = document.getElementById(`sensor-bar-${i}`);
        if (barEl) {
            const reading = car.sensor.readings[i];
            const distPercent = reading ? (reading.offset * 100) : 100;
            barEl.style.width = `${distPercent}%`;
            
            // Color indicator (Red if extremely close)
            if (distPercent < 25) {
                barEl.style.backgroundColor = '#d63031';
            } else if (distPercent < 60) {
                barEl.style.backgroundColor = '#f39c12';
            } else {
                barEl.style.backgroundColor = '#00f2fe';
            }
        }
    }
}

// Start Dashboard
loadAIModel().then(() => {
    tick();
});
