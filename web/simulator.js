class Track {
    constructor() {
        // Track center points (looping racetrack)
        this.points = [
            {x: 100, y: 300},
            {x: 150, y: 150},
            {x: 350, y: 100},
            {x: 600, y: 120},
            {x: 750, y: 220},
            {x: 700, y: 400},
            {x: 550, y: 480},
            {x: 400, y: 450},
            {x: 250, y: 520},
            {x: 100, y: 450}
        ];
        this.width = 75; // Road width
    }

    draw(ctx, isOffscreen = false) {
        // Draw asphalt base
        ctx.beginPath();
        ctx.strokeStyle = '#2d3436';
        ctx.lineWidth = this.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        this.createPath(ctx);
        ctx.stroke();

        if (isOffscreen) {
            // Draw yellow center line (solid/dashed for camera features)
            ctx.beginPath();
            ctx.strokeStyle = '#f1c40f';
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 15]);
            this.createPath(ctx);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw red/white curbs
            ctx.beginPath();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = this.width + 8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            this.createPath(ctx);
            ctx.stroke();

            ctx.beginPath();
            ctx.strokeStyle = '#d63031';
            ctx.lineWidth = this.width + 8;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([20, 20]);
            this.createPath(ctx);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw inner/outer dark separator to clean up curbs
            ctx.beginPath();
            ctx.strokeStyle = '#2d3436';
            ctx.lineWidth = this.width;
            this.createPath(ctx);
            ctx.stroke();
            return;
        }

        // GUI details (only drawn on onscreen canvas)
        // Center dotted line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(241, 196, 15, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 12]);
        this.createPath(ctx);
        ctx.stroke();
        ctx.setLineDash([]);

        // Curbs (White & Red styling)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = this.width + 4;
        this.createPath(ctx);
        ctx.stroke();
    }

    createPath(ctx) {
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.closePath();
    }

    // Get track boundaries (outer and inner polygons)
    getBoundaries() {
        const outer = [];
        const inner = [];
        const n = this.points.length;

        for (let i = 0; i < n; i++) {
            const p1 = this.points[i];
            const p2 = this.points[(i + 1) % n];
            const p0 = this.points[(i - 1 + n) % n];

            // Normal vectors
            const dx1 = p2.x - p1.x;
            const dy1 = p2.y - p1.y;
            const len1 = Math.hypot(dx1, dy1);
            const nx1 = -dy1 / len1;
            const ny1 = dx1 / len1;

            const dx0 = p1.x - p0.x;
            const dy0 = p1.y - p0.y;
            const len0 = Math.hypot(dx0, dy0);
            const nx0 = -dy0 / len0;
            const ny0 = dx0 / len0;

            // Average normals at vertex
            const nx = (nx0 + nx1) / 2;
            const ny = (ny0 + ny1) / 2;
            const len = Math.hypot(nx, ny);
            const nnx = nx / len;
            const nny = ny / len;

            // Offset distance
            const halfW = this.width / 2;
            outer.push({x: p1.x + nnx * halfW, y: p1.y + nny * halfW});
            inner.push({x: p1.x - nnx * halfW, y: p1.y - nny * halfW});
        }
        return {outer, inner};
    }
}

class Sensor {
    constructor(car) {
        this.car = car;
        this.rayCount = 5;
        this.rayLength = 120;
        this.raySpread = Math.PI / 2; // 90 degrees total angle
        this.rays = [];
        this.readings = [];
    }

    update(boundaries) {
        this.#castRays();
        this.readings = [];
        for (let i = 0; i < this.rays.length; i++) {
            this.readings.push(this.#getReading(this.rays[i], boundaries));
        }
    }

    #getReading(ray, boundaries) {
        let touches = [];

        // Check intersection with outer boundary
        for (let i = 0; i < boundaries.outer.length; i++) {
            const p1 = boundaries.outer[i];
            const p2 = boundaries.outer[(i + 1) % boundaries.outer.length];
            const touch = getIntersection(ray[0], ray[1], p1, p2);
            if (touch) touches.push(touch);
        }

        // Check intersection with inner boundary
        for (let i = 0; i < boundaries.inner.length; i++) {
            const p1 = boundaries.inner[i];
            const p2 = boundaries.inner[(i + 1) % boundaries.inner.length];
            const touch = getIntersection(ray[0], ray[1], p1, p2);
            if (touch) touches.push(touch);
        }

        if (touches.length === 0) return null;

        // Return closest touch point
        const offsets = touches.map(t => t.offset);
        const minOffset = Math.min(...offsets);
        return touches.find(t => t.offset === minOffset);
    }

    #castRays() {
        this.rays = [];
        for (let i = 0; i < this.rayCount; i++) {
            const rayAngle = lerp(
                this.raySpread / 2,
                -this.raySpread / 2,
                this.rayCount === 1 ? 0.5 : i / (this.rayCount - 1)
            ) + this.car.angle;

            const start = {x: this.car.x, y: this.car.y};
            const end = {
                x: this.car.x - Math.sin(rayAngle) * this.rayLength,
                y: this.car.y - Math.cos(rayAngle) * this.rayLength
            };
            this.rays.push([start, end]);
        }
    }

    draw(ctx) {
        for (let i = 0; i < this.rayCount; i++) {
            let end = this.rays[i][1];
            if (this.readings[i]) {
                end = this.readings[i];
            }

            // Draw active ray (yellow)
            ctx.beginPath();
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = 'rgba(241, 196, 15, 0.4)';
            ctx.moveTo(this.rays[i][0].x, this.rays[i][0].y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            // Draw remaining segment (darker)
            if (this.readings[i]) {
                ctx.beginPath();
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.moveTo(end.x, end.y);
                ctx.lineTo(this.rays[i][1].x, this.rays[i][1].y);
                ctx.stroke();
            }
        }
    }
}

class Car {
    constructor(x, y, track) {
        this.x = x;
        this.y = y;
        this.width = 16;
        this.height = 30;

        this.speed = 0;
        this.maxSpeed = 10;
        this.friction = 0.05;
        this.angle = Math.PI * 1.5; // Facing left initial direction
        this.acceleration = 0.2;

        this.sensor = new Sensor(this);
        this.track = track;

        // User controls state
        this.controls = {
            forward: false,
            left: false,
            right: false,
            reverse: false
        };
    }

    update() {
        this.#move();
        const boundaries = this.track.getBoundaries();
        this.sensor.update(boundaries);
    }

    #move() {
        if (this.controls.forward) {
            this.speed += this.acceleration;
        }
        if (this.controls.reverse) {
            this.speed -= this.acceleration;
        }

        // Apply max speed limits
        if (this.speed > this.maxSpeed) {
            this.speed = this.maxSpeed;
        }
        if (this.speed < -this.maxSpeed / 2) {
            this.speed = -this.maxSpeed / 2;
        }

        // Friction
        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < this.friction) this.speed = 0;

        // Steering (only steer if moving)
        if (this.speed !== 0) {
            const flip = this.speed > 0 ? 1 : -1;
            const steeringFactor = 0.045 * (this.speed / this.maxSpeed + 0.3); // smooth dynamic steering
            if (this.controls.left) {
                this.angle += steeringFactor * flip;
            }
            if (this.controls.right) {
                this.angle -= steeringFactor * flip;
            }
        }

        this.x -= Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-this.angle);

        // Glassmorphic shadow/glow
        ctx.shadowColor = '#6c5ce7';
        ctx.shadowBlur = 10;

        // Car Body
        ctx.fillStyle = '#6c5ce7';
        ctx.beginPath();
        ctx.roundRect(-this.width / 2, -this.height / 2, this.width, this.height, 4);
        ctx.fill();

        // Details (Windshield)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0f1016';
        ctx.fillRect(-this.width / 2 + 2, -this.height / 2 + 6, this.width - 4, 8);
        
        // Headlights
        ctx.fillStyle = '#00f2fe';
        ctx.fillRect(-this.width / 2 + 1, -this.height / 2 + 1, 3, 2);
        ctx.fillRect(this.width / 2 - 4, -this.height / 2 + 1, 3, 2);

        ctx.restore();

        // Draw sensors
        this.sensor.draw(ctx);
    }

    // Capture front camera perspective and draw onto destination canvas
    captureCamera(offscreenCanvas, destCanvas) {
        const destCtx = destCanvas.getContext('2d');
        const dw = destCanvas.width;
        const dh = destCanvas.height;

        // Create virtual camera trapezoid in world coordinates
        // Look ahead distance
        const distMin = 10;
        const distMax = 70;
        const widthNear = 20;
        const widthFar = 60;

        // Vertices of the trapezoid in front of the car
        const cameraAngle = this.angle;
        const cos = Math.cos(cameraAngle);
        const sin = Math.sin(cameraAngle);

        const getPt = (lx, ly) => {
            // Transform local car coordinate lx (left/right), ly (forward) to world coordinates
            return {
                x: this.x - lx * cos - ly * sin,
                y: this.y + lx * sin - ly * cos
            };
        };

        const pNearLeft = getPt(-widthNear / 2, distMin);
        const pNearRight = getPt(widthNear / 2, distMin);
        const pFarLeft = getPt(-widthFar / 2, distMax);
        const pFarRight = getPt(widthFar / 2, distMax);

        // Perform a grid mapping approximation of perspective projection
        // Canvas does not have direct 3D perspective warp, so we render horizontal strips (bilinear mapping)
        destCtx.fillStyle = '#08090d';
        destCtx.fillRect(0, 0, dw, dh);

        const slices = 33; // number of horizontal slices
        for (let i = 0; i < slices; i++) {
            const t = i / (slices - 1); // vertical index in dest canvas (0 = top/horizon, 1 = bottom/near)
            
            // Linear interpolate the left and right edge points
            const pl = {
                x: lerp(pFarLeft.x, pNearLeft.x, t),
                y: lerp(pFarLeft.y, pNearLeft.y, t)
            };
            const pr = {
                x: lerp(pFarRight.x, pNearRight.x, t),
                y: lerp(pFarRight.y, pNearRight.y, t)
            };

            const destY = Math.floor(t * dh);
            const sliceHeight = Math.ceil(dh / slices);

            // Draw a single horizontal line of pixels by sampling from offscreen canvas
            // Standard technique: drawImage with src rect and dest rect
            // Since we need to rotate/warp, we map the sample line from pl to pr.
            // For Canvas, we can rotate and draw, or sample point-by-point.
            // Sampling 200 points per line in JS:
            const imgData = destCtx.createImageData(dw, sliceHeight);
            const offCtx = offscreenCanvas.getContext('2d');
            
            for (let x = 0; x < dw; x++) {
                const xt = x / (dw - 1);
                // Sample point in world coordinates
                const sx = Math.floor(lerp(pl.x, pr.x, xt));
                const sy = Math.floor(lerp(pl.y, pr.y, xt));

                // Get pixel color from offscreen canvas
                if (sx >= 0 && sx < offscreenCanvas.width && sy >= 0 && sy < offscreenCanvas.height) {
                    const pixel = offCtx.getImageData(sx, sy, 1, 1).data;
                    for (let c = 0; c < 4; c++) {
                        imgData.data[(x + 0) * 4 + c] = pixel[c];
                    }
                } else {
                    // Out of bounds is grass (greenish-black)
                    imgData.data[x * 4 + 0] = 16;
                    imgData.data[x * 4 + 1] = 30;
                    imgData.data[x * 4 + 2] = 20;
                    imgData.data[x * 4 + 3] = 255;
                }
            }
            destCtx.putImageData(imgData, 0, destY);
        }
    }
}

// Helper math utilities
function lerp(A, B, t) {
    return A + (B - A) * t;
}

function getIntersection(A, B, C, D) {
    const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
    const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
    const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);

    if (bottom !== 0) {
        const t = tTop / bottom;
        const u = uTop / bottom;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: lerp(A.x, B.x, t),
                y: lerp(A.y, B.y, t),
                offset: t
            };
        }
    }
    return null;
}
