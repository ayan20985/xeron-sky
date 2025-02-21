class SkyRenderer {
    constructor(canvas) {
        // Add version info
        this.version = "v0.13";

        this.canvas = canvas;
        this.gl = canvas.getContext('webgl', { alpha: false }) || canvas.getContext('experimental-webgl', { alpha: false });
        if (!this.gl) {
            throw new Error('WebGL not supported');
        }

        // Create 2D context for overlays
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.top = '0';
        this.overlayCanvas.style.left = '0';
        this.overlayCanvas.style.width = '100%';
        this.overlayCanvas.style.height = '100%';
        this.overlayCanvas.style.pointerEvents = 'none';
        canvas.parentNode.appendChild(this.overlayCanvas);
        this.ctx2d = this.overlayCanvas.getContext('2d');

        // Store active stars and their info windows
        this.activeStars = new Map(); // Map of star ID to {star, infoWindow} objects

        // Add visibility settings first
        this.visibility = {
            showGrid: true,
            showEquatorial: true,
            showGalactic: true,
            showAzimuthal: true,
            showEcliptic: true,
            showLabels: true,
            showConstellations: true,
            showMeteors: true,
            showStars: true,
            showNebulae: true,
            showGalaxies: true,
            showClusters: true
        };

        // Initialize WebGL context and resources
        this.initializeGL(this.gl);
        this.initShaders(this.gl);
        this.initBuffers(this.gl);

        // Add rotation for Hammer projection
        this.hammerRotation = 0;

        // Add pan parameters
        this.pan = { x: 0, y: 0 };
        this.scale = 1.0;
        this.rotation = { x: 0, y: 0 };
        this.zoom = 2.0;
        this.projectionType = 'spherical';  // Default projection
        
        // Initialize meteor showers array
        this.meteorShowers = [];
        
        // Initialize grid
        this.initGrid();
        
        // Bind events
        this.bindEvents(canvas);

        // Initial resize
        this.resize();
    }

    initializeGL(gl) {
        gl.clearColor(0.0, 0.02, 0.05, 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    }

    positionCanvases() {
        this.canvases.spherical.style.left = '0';
        this.canvases.spherical.style.top = '0';
        
        this.canvases.stereographic.style.right = '0';
        this.canvases.stereographic.style.top = '0';
        
        this.canvases.mercator.style.left = '0';
        this.canvases.mercator.style.bottom = '0';
        
        this.canvases.hammer.style.right = '0';
        this.canvases.hammer.style.bottom = '0';
    }

    setProjection(type) {
        const validTypes = ['spherical', 'stereographic', 'mercator', 'hammer'];
        if (validTypes.includes(type)) {
            this.projectionType = type;
            if (this.stars) {
                this.updateStarData(this.stars);
            }
        }
    }

    initShaders(gl) {
        // Vertex shader program for stars
        const vsSource = `
            attribute vec3 aPosition;
            attribute float aMagnitude;
            attribute vec3 aColor;
            
            uniform mat4 uModelViewMatrix;
            uniform mat4 uProjectionMatrix;
            
            varying float vMagnitude;
            varying vec3 vColor;
            
            void main() {
                vec4 pos = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
                gl_Position = pos;
                float size = pow(2.0, (6.0 - aMagnitude)) * 2.0;
                float pointSize = size / pos.w;
                pointSize = clamp(pointSize, 3.0, 10.0);
                gl_PointSize = pointSize;
                vMagnitude = aMagnitude;
                vColor = aColor;
            }
        `;

        // Fragment shader program for stars
        const fsSource = `
            precision mediump float;
            varying float vMagnitude;
            varying vec3 vColor;
            
            void main() {
                vec2 center = gl_PointCoord - vec2(0.5);
                float dist = length(center);
                
                // Simple circle with hard edge
                if (dist > 0.5) discard;
                
                float brightness = pow(2.0, -vMagnitude * 0.5);
                
                // Use pure star color without mixing or gradients
                vec3 color = vColor * 1.5;  // Boost color intensity
                
                gl_FragColor = vec4(color, brightness);
            }
        `;

        // Create shader program for this context
        const program = this.createShaderProgram(gl, vsSource, fsSource);
        this.starProgram = program;
        
        // Get attribute locations for this context
        this.starAttributes = {
            position: gl.getAttribLocation(program, 'aPosition'),
            magnitude: gl.getAttribLocation(program, 'aMagnitude'),
            color: gl.getAttribLocation(program, 'aColor')
        };

        // Get uniform locations for this context
        this.starUniforms = {
            modelView: gl.getUniformLocation(program, 'uModelViewMatrix'),
            projection: gl.getUniformLocation(program, 'uProjectionMatrix')
        };
    }

    createShaderProgram(gl, vsSource, fsSource) {
        const vertexShader = this.compileShader(gl, vsSource, gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(gl, fsSource, gl.FRAGMENT_SHADER);
        
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.deleteProgram(program);
            throw new Error('Unable to initialize shader program: ' + gl.getProgramInfoLog(program));
        }

        return program;
    }

    compileShader(gl, source, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            gl.deleteShader(shader);
            throw new Error('Shader compile error: ' + gl.getShaderInfoLog(shader));
        }

        return shader;
    }

    initBuffers(gl) {
        // Create buffers for this context
        this.starBuffers = {
            position: gl.createBuffer(),
            magnitude: gl.createBuffer(),
            color: gl.createBuffer()
        };
    }

    bindEvents(canvas) {
        let isDragging = false;
        let lastX = 0;
        let lastY = 0;
        let hoveredPoint = null;

        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        // Add mousemove handler for hover text
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Check for hover over special points
            let foundPoint = null;
            if (this.hoverAreas) {
                for (const area of this.hoverAreas) {
                    if (mouseX >= area.x && mouseX <= area.x + area.width &&
                        mouseY >= area.y && mouseY <= area.y + area.height) {
                        foundPoint = area.point;
                        break;
                    }
                }
            }
            
            if (foundPoint !== hoveredPoint) {
                hoveredPoint = foundPoint;
                if (hoveredPoint) {
                    canvas.style.cursor = 'pointer';
                    // Show tooltip
                    const tooltip = document.getElementById('sky-tooltip') || document.createElement('div');
                    tooltip.id = 'sky-tooltip';
                    tooltip.style.position = 'absolute';
                    tooltip.style.backgroundColor = '#222';
                    tooltip.style.color = '#fff';
                    tooltip.style.padding = '5px';
                    tooltip.style.border = '1px solid #444';
                    tooltip.style.borderRadius = '3px';
                    tooltip.style.fontSize = '12px';
                    tooltip.style.pointerEvents = 'none';
                    tooltip.style.zIndex = '1001'; // Increase z-index to show above control panel
                    tooltip.textContent = hoveredPoint.name;
                    
                    if (!document.getElementById('sky-tooltip')) {
                        canvas.parentNode.appendChild(tooltip);
                    }
                    
                    // Position tooltip
                    tooltip.style.left = (e.clientX + 10) + 'px';
                    tooltip.style.top = (e.clientY + 10) + 'px';
                } else {
                    canvas.style.cursor = '';
                    const tooltip = document.getElementById('sky-tooltip');
                    if (tooltip) {
                        tooltip.remove();
                    }
                }
            } else if (hoveredPoint) {
                // Update tooltip position if still hovering
                const tooltip = document.getElementById('sky-tooltip');
                if (tooltip) {
                    tooltip.style.left = (e.clientX + 10) + 'px';
                    tooltip.style.top = (e.clientY + 10) + 'px';
                }
            }

            if (!isDragging) return;
            
            const deltaX = e.clientX - lastX;
            const deltaY = e.clientY - lastY;
            
            switch (this.projectionType) {
                case 'spherical':
                // 3D rotation for spherical projection
                this.rotation.x += deltaY * 0.005;
                this.rotation.y += deltaX * 0.005;
                    break;
                    
                case 'stereographic':
                    // Regular 2D pan for stereographic
                    const stereoScaleFactor = 2.0 / (this.scale * this.gl.canvas.width);
                    this.pan.x += deltaX * stereoScaleFactor;
                    this.pan.y -= deltaY * stereoScaleFactor;
                    break;
                    
                case 'hammer':
                    if (e.shiftKey) {
                        // Rotate around polar axis when shift is held
                        this.hammerRotation += deltaX * 0.005;
            } else {
                        // Pan normally
                        const hammerScaleFactor = 2.0 / (this.scale * this.gl.canvas.width);
                        this.pan.x += deltaX * hammerScaleFactor;
                        this.pan.y -= deltaY * hammerScaleFactor;
                    }
                    break;
                    
                case 'mercator':
                    // Infinite horizontal scroll for Mercator
                    const mercatorScaleFactor = 2.0 / (this.scale * this.gl.canvas.width);
                    this.pan.x += deltaX * mercatorScaleFactor;
                    // Limit vertical pan to avoid extreme distortion
                    const newY = this.pan.y - deltaY * mercatorScaleFactor;
                    this.pan.y = Math.max(Math.min(newY, Math.PI/2), -Math.PI/2);
                    break;
            }
            
            lastX = e.clientX;
            lastY = e.clientY;
            
            this.render();
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
        });

        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
        });
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            if (!this.stars) {
                console.warn('No stars available.');
                return;
            }

            // Use the same time as the current render
            const currentTime = this.currentRenderTime || new Date();
            
            // Store the current time so it can be used when creating the info window
            this.lastClickTime = currentTime;
            
            const transformedStars = this.transformStarsForProjection(this.stars, this.projectionType, currentTime);
            
            // Update matrices to ensure correct projection
            this.updateMatrices();
            
            let closestStar = null;
            let minDistance = Infinity;
            let closestProjected = null;
            
            transformedStars.forEach(star => {
                const projected = this.projectPoint(star);
                if (projected) {
                    const dx = projected.x - mouseX;
                    const dy = projected.y - mouseY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestStar = star;
                        closestProjected = projected;
                    }
                }
            });

            const threshold = 10; // Use consistent screen-space threshold

            if (minDistance < threshold && closestStar && closestProjected) {
                const infoDiv = document.createElement('div');
                infoDiv.style.position = 'absolute';
                // Use the projected position for placing the info window
                infoDiv.style.left = (closestProjected.x + 20) + 'px';
                infoDiv.style.top = (closestProjected.y - 20) + 'px';
                infoDiv.style.padding = '5px';
                infoDiv.style.backgroundColor = '#222';
                infoDiv.style.color = '#fff';
                infoDiv.style.border = '1px solid #444';
                infoDiv.style.borderRadius = '3px';
                infoDiv.style.zIndex = '1001';
                const tabContainer = document.createElement('div');
                tabContainer.style.display = 'flex';
                tabContainer.style.borderBottom = '1px solid #444';
                tabContainer.style.marginBottom = '5px';
                tabContainer.style.cursor = 'pointer';
                const summaryTab = document.createElement('div');
                summaryTab.textContent = 'Summary';
                summaryTab.style.flex = '1';
                summaryTab.style.padding = '5px';
                summaryTab.style.backgroundColor = '#222';
                summaryTab.style.color = '#fff';
                summaryTab.style.textAlign = 'center';
                const rawTab = document.createElement('div');
                rawTab.textContent = 'Raw';
                rawTab.style.flex = '1';
                rawTab.style.padding = '5px';
                rawTab.style.backgroundColor = '#444';
                rawTab.style.color = '#fff';
                rawTab.style.textAlign = 'center';
                tabContainer.appendChild(summaryTab);
                tabContainer.appendChild(rawTab);
                const contentContainer = document.createElement('div');
                contentContainer.style.padding = '5px';
                contentContainer.style.color = '#fff';
                contentContainer.style.fontSize = '12px';
                function showSummary() {
                    summaryTab.style.backgroundColor = '#222';
                    rawTab.style.backgroundColor = '#444';
                    contentContainer.innerHTML = '';
                    const starInfo = document.createElement('div');
                    const name = closestStar.name || 'N/A';
                    const id = closestStar.id || 'N/A';
                    const magnitude = (closestStar.magnitude !== undefined) ? closestStar.magnitude : 'N/A';
                    const spectral = closestStar.spectralType || (closestStar.colorIndex !== undefined ? closestStar.colorIndex : 'N/A');
                    starInfo.innerHTML = '<strong>Name:</strong> ' + name + '<br>' +
                                          '<strong>ID:</strong> ' + id + '<br>' +
                                          '<strong>Magnitude:</strong> ' + magnitude + '<br>' +
                                          '<strong>Spectral Type / Color Index:</strong> ' + spectral;
                    contentContainer.appendChild(starInfo);
                }
                function showRaw() {
                    rawTab.style.backgroundColor = '#222';
                    summaryTab.style.backgroundColor = '#444';
                    contentContainer.innerHTML = '<pre style="margin:0; font-size:12px;">' + JSON.stringify(closestStar, null, 2) + '</pre>';
                }
                showSummary();
                summaryTab.addEventListener('click', showSummary);
                rawTab.addEventListener('click', showRaw);
                infoDiv.appendChild(tabContainer);
                infoDiv.appendChild(contentContainer);
                const starId = closestStar.id;
                
                // Create header with close button
                const closeBtn = document.createElement('button');
                closeBtn.innerHTML = '&times;';
                closeBtn.style.fontSize = '16px';
                closeBtn.style.lineHeight = '16px';
                closeBtn.style.padding = '0';
                closeBtn.style.background = 'transparent';
                closeBtn.style.border = 'none';
                closeBtn.style.color = 'white';
                closeBtn.style.cursor = 'pointer';
                closeBtn.addEventListener('click', () => {
                    this.activeStars.delete(starId);
                    infoDiv.remove();
                    this.render();
                });

                // Create draggable header
                const headerDiv = document.createElement('div');
                headerDiv.style.display = 'flex';
                headerDiv.style.justifyContent = 'flex-end';
                headerDiv.style.cursor = 'move';
                headerDiv.appendChild(closeBtn);
                headerDiv.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const rect = infoDiv.getBoundingClientRect();
                    const origLeft = rect.left;
                    const origTop = rect.top;
                    
                    const onMouseMove = (evt) => {
                        const newLeft = origLeft + (evt.clientX - startX);
                        const newTop = origTop + (evt.clientY - startY);
                        infoDiv.style.left = newLeft + 'px';
                        infoDiv.style.top = newTop + 'px';
                        evt.preventDefault();
                    };
                    
                    const onMouseUp = () => {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                    };
                    
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
                
                infoDiv.insertBefore(headerDiv, infoDiv.firstChild);
                canvas.parentNode.appendChild(infoDiv);
                
                // Store both the original and transformed star data
                this.activeStars.set(closestStar.id, {
                    star: closestStar,
                    infoWindow: infoDiv,
                    timeCreated: currentTime
                });
                this.render();
            }
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            if (this.projectionType === 'spherical') {
                // 3D zoom for spherical projection
                this.zoom *= e.deltaY > 0 ? 0.9 : 1.1;
                this.zoom = Math.max(0.1, Math.min(this.zoom, 5.0));
            } else {
                // 2D zoom for flat projections
                const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
                
                // Get mouse position in canvas coordinates
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // Convert to normalized device coordinates (-1 to 1)
                const ndcX = (mouseX / canvas.width) * 2 - 1;
                const ndcY = 1 - (mouseY / canvas.height) * 2;
                
                // Adjust pan to zoom around mouse position
                this.pan.x = (this.pan.x - ndcX) * zoomFactor + ndcX;
                this.pan.y = (this.pan.y - ndcY) * zoomFactor + ndcY;
                
                // Update scale
                this.scale *= zoomFactor;
                this.scale = Math.max(0.1, Math.min(this.scale, 10.0));
            }
            
            this.render();
        });

        window.addEventListener('resize', () => {
            this.resize();
        });
    }

    resize() {
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;

        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;
            this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
            
            // Resize 2D canvas
            this.ctx2d.canvas.width = displayWidth;
            this.ctx2d.canvas.height = displayHeight;
        }
    }

    updateStarData(stars, currentTime = new Date()) {
        if (!stars || stars.length === 0) {
            console.error('No stars provided to updateStarData');
            return;
        }

        this.stars = stars;
        const transformedStars = this.transformStarsForProjection(stars, this.projectionType, currentTime);
        
        // Update positions of active stars
        transformedStars.forEach(transformedStar => {
            if (this.activeStars.has(transformedStar.id)) {
                const info = this.activeStars.get(transformedStar.id);
                info.star = transformedStar;  // Update with new transformed position
            }
        });
        
        const positions = new Float32Array(transformedStars.length * 3);
        const magnitudes = new Float32Array(transformedStars.length);
        const colors = new Float32Array(transformedStars.length * 3);

        transformedStars.forEach((star, i) => {
            positions[i * 3] = star.x;
            positions[i * 3 + 1] = star.y;
            positions[i * 3 + 2] = star.z;
            magnitudes[i] = star.magnitude;
            
            const [r, g, b] = star.spectralType ? 
                this.spectralTypeToRGB(star.spectralType) :
                this.colorIndexToRGB(star.colorIndex);
            
            colors[i * 3] = r;
            colors[i * 3 + 1] = g;
            colors[i * 3 + 2] = b;
        });

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.starBuffers.position);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.starBuffers.magnitude);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, magnitudes, this.gl.STATIC_DRAW);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.starBuffers.color);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, colors, this.gl.STATIC_DRAW);

        this.starCount = transformedStars.length;
    }

    drawStars() {
        if (!this.starCount) {
            console.warn('No stars to draw');
            return;
        }

        this.gl.useProgram(this.starProgram);

        // Update matrices
        this.gl.uniformMatrix4fv(this.starUniforms.projection, false, this.projectionMatrix);
        this.gl.uniformMatrix4fv(this.starUniforms.modelView, false, this.modelViewMatrix);

        // Enable blending for better star appearance
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);

        // Bind position buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.starBuffers.position);
        this.gl.vertexAttribPointer(this.starAttributes.position, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.starAttributes.position);

        // Bind magnitude buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.starBuffers.magnitude);
        this.gl.vertexAttribPointer(this.starAttributes.magnitude, 1, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.starAttributes.magnitude);

        // Bind color buffer
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.starBuffers.color);
        this.gl.vertexAttribPointer(this.starAttributes.color, 3, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(this.starAttributes.color);

        // Draw stars
        this.gl.drawArrays(this.gl.POINTS, 0, this.starCount);

        // Check for WebGL errors
        const error = this.gl.getError();
        if (error !== this.gl.NO_ERROR) {
            console.error('WebGL error during star rendering:', error);
        }

        // Cleanup
        this.gl.disableVertexAttribArray(this.starAttributes.position);
        this.gl.disableVertexAttribArray(this.starAttributes.magnitude);
        this.gl.disableVertexAttribArray(this.starAttributes.color);
        this.gl.disable(this.gl.BLEND);
    }

    drawDeepSkyObjects() {
        if (!this.deepSkyObjects || !this.ctx2d) return;
        
        const ctx = this.ctx2d;
        
        Object.entries(this.deepSkyObjects).forEach(([type, objects]) => {
            if (!Array.isArray(objects)) return;
            
            objects.forEach(obj => {
                if (!obj || typeof obj.ra === 'undefined' || typeof obj.dec === 'undefined') return;

                const coords = this.equatorialToCartesian(obj.ra, obj.dec);
                const pos = this.projectPoint(coords);
                if (!pos) return;

                const size = Math.max(20, (obj.size || 10) * this.zoom);
                
                // Different rendering based on object type
                switch(obj.type) {
                    case 'diffuse':
                    case 'planetary':
                    case 'supernova':
                        this.drawNebula(ctx, pos, size, obj);
                        break;
                    case 'spiral':
                    case 'galaxy':
                        this.drawGalaxy(ctx, pos, size, obj);
                        break;
                    case 'globular':
                    case 'open':
                        this.drawCluster(ctx, pos, size, obj);
                        break;
                }

                // Add labels for bright objects
                if (obj.magnitude < 8) {
                    ctx.fillStyle = 'rgba(200, 200, 255, 0.8)';
                    ctx.font = '12px Arial';
                    ctx.fillText(`${obj.name} (${obj.type})`, pos.x + size + 5, pos.y);
                }
            });
        });
    }

    drawNebula(ctx, pos, size, obj) {
        try {
            // Ensure all values are finite
            const x = Number(pos.x) || 0;
            const y = Number(pos.y) || 0;
            const s = Math.min(Math.max(Number(size) || 20, 10), 1000);
            const color = obj.color || [0.8, 0.6, 0.9];

            // Create complex gradient for nebula
                const gradient = ctx.createRadialGradient(
                    x, y, 0,
                x, y, s
                );

            // Multiple color stops for more complex appearance
            gradient.addColorStop(0, `rgba(${color[0]*255}, ${color[1]*255}, ${color[2]*255}, 0.8)`);
            gradient.addColorStop(0.3, `rgba(${color[0]*255}, ${color[1]*255}, ${color[2]*255}, 0.6)`);
            gradient.addColorStop(0.7, `rgba(${color[0]*255}, ${color[1]*255}, ${color[2]*255}, 0.3)`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

            // Draw main nebula shape
            ctx.beginPath();
            ctx.arc(x, y, s, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();

            // Add internal structure
            for (let i = 0; i < 5; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = Math.random() * s * 0.7;
                const subSize = s * (0.2 + Math.random() * 0.3);
                    
                const sx = x + Math.cos(angle) * distance;
                const sy = y + Math.sin(angle) * distance;
                    
                const subGradient = ctx.createRadialGradient(sx, sy, 0, sx, sy, subSize);
                subGradient.addColorStop(0, `rgba(${color[0]*255}, ${color[1]*255}, ${color[2]*255}, 0.6)`);
                subGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    
                    ctx.beginPath();
                ctx.arc(sx, sy, subSize, 0, Math.PI * 2);
                ctx.fillStyle = subGradient;
                    ctx.fill();
                }
        } catch (error) {
            console.error('Error drawing nebula:', error);
        }
    }

    drawGalaxy(ctx, pos, size, obj) {
        // Create spiral galaxy effect
            const numArms = 4;
            const rotations = 2;
            
            for (let arm = 0; arm < numArms; arm++) {
                const startAngle = (arm / numArms) * Math.PI * 2;
                
                ctx.beginPath();
            for (let t = 0; t <= 1; t += 0.01) {
                    const angle = startAngle + t * Math.PI * 2 * rotations;
                const scale = t * size;
                const x = pos.x + Math.cos(angle) * scale;
                const y = pos.y + Math.sin(angle) * scale;
                    
                if (t === 0) {
                    ctx.moveTo(x, y);
                    } else {
                    ctx.lineTo(x, y);
                    }
                }
                
            const gradient = ctx.createLinearGradient(
                pos.x - size, pos.y - size,
                pos.x + size, pos.y + size
                );
            gradient.addColorStop(0, `rgba(${obj.color[0]*255}, ${obj.color[1]*255}, ${obj.color[2]*255}, 0.8)`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
                ctx.stroke();
        }
    }

    drawCluster(ctx, pos, size, obj) {
        // Draw multiple stars in a cluster pattern
        const numStars = obj.type === 'globular' ? 50 : 20;
        
        for (let i = 0; i < numStars; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * size * (obj.type === 'globular' ? 0.5 : 0.8);
            const starSize = 2 + Math.random() * 3;
            
            const x = pos.x + Math.cos(angle) * distance;
            const y = pos.y + Math.sin(angle) * distance;
            
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, starSize);
            gradient.addColorStop(0, `rgba(${obj.color[0]*255}, ${obj.color[1]*255}, ${obj.color[2]*255}, 0.8)`);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.beginPath();
            ctx.arc(x, y, starSize, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }
    }

    drawMeteorShowers() {
        if (!this.meteorShowers || !Array.isArray(this.meteorShowers)) return;
        
        const ctx = this.ctx2d;
        
        this.meteorShowers.forEach(shower => {
            if (!shower || !shower.active || !shower.radiant) return;
            
            const pos = this.projectPoint(shower.radiant);
            if (!pos) return;

            // Draw radiant point with glow
            try {
                const radiantGradient = ctx.createRadialGradient(
                    pos.x, pos.y, 0,
                    pos.x, pos.y, 20
                );
                radiantGradient.addColorStop(0, `rgba(${shower.color[0]*255}, ${shower.color[1]*255}, ${shower.color[2]*255}, 0.8)`);
                radiantGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                
                ctx.beginPath();
                ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
                ctx.fillStyle = radiantGradient;
                ctx.fill();

                // Draw label
                ctx.fillStyle = 'rgba(200, 200, 255, 0.8)';
                ctx.font = '12px Arial';
                ctx.fillText(`${shower.name} (${shower.zhr}/hr)`, pos.x + 25, pos.y);

                // Draw meteors with trails and particle effects
                const numMeteors = Math.min(8, shower.zhr / 15);
                for (let i = 0; i < numMeteors; i++) {
                    this.drawMeteorWithParticles(ctx, pos, shower);
                }
            } catch (error) {
                console.error('Error drawing meteor shower:', error);
            }
        });
    }

    drawMeteorWithParticles(ctx, radiant, shower) {
            const angle = Math.random() * Math.PI * 2;
        const length = 100 + Math.random() * 100;
            const speed = shower.speed / 30;
            
        const endX = radiant.x + Math.cos(angle) * length;
        const endY = radiant.y + Math.sin(angle) * length;
            
            // Draw main meteor trail
        const gradient = ctx.createLinearGradient(radiant.x, radiant.y, endX, endY);
        gradient.addColorStop(0, `rgba(${shower.color[0]*255}, ${shower.color[1]*255}, ${shower.color[2]*255}, 0.8)`);
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            
            ctx.beginPath();
        ctx.moveTo(radiant.x, radiant.y);
            ctx.lineTo(endX, endY);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
            ctx.stroke();
            
        // Add particle effects
        const numParticles = 10;
            for (let i = 0; i < numParticles; i++) {
                const t = i / numParticles;
            const x = radiant.x + (endX - radiant.x) * t;
            const y = radiant.y + (endY - radiant.y) * t;
                
            const particleGradient = ctx.createRadialGradient(x, y, 0, x, y, 3);
            particleGradient.addColorStop(0, `rgba(${shower.color[0]*255}, ${shower.color[1]*255}, ${shower.color[2]*255}, ${0.5 * (1-t)})`);
            particleGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                
                ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
                ctx.fillStyle = particleGradient;

                ctx.fill();
        }
    }

    setVisibility(setting, value) {
        if (setting in this.visibility) {
            this.visibility[setting] = value;
        }
    }

    drawVersionInfo() {
        const ctx = this.ctx2d;
        const padding = 10;
        const lineHeight = 16;
        
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        
        // Draw engine name and version
        ctx.fillText(`Xeron Sky Engine ${this.version}`, padding, this.canvas.height - padding - (lineHeight * 2));
        
        // Draw disclaimer and website link
        ctx.fillText('© 2025 Xeron Sky Engine - For Tomfoolery and Magic', padding, this.canvas.height - padding - lineHeight);
        
        // Draw website link with underline
        const websiteText = 'www.ayanali.net';
        const websiteY = this.canvas.height - padding;
        ctx.fillStyle = 'rgba(100, 149, 237, 0.9)';  // Cornflower blue color
        ctx.fillText(websiteText, padding, websiteY);
        
        // Add underline
        const textWidth = ctx.measureText(websiteText).width;
        ctx.beginPath();
        ctx.moveTo(padding, websiteY + 2);
        ctx.lineTo(padding + textWidth, websiteY + 2);
        ctx.strokeStyle = 'rgba(100, 149, 237, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.restore();
    }

    render(currentTime = new Date()) {
        // Store the current render time for use in click detection
        this.currentRenderTime = currentTime;
        
        this.resize();

        // Clear canvases
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        if (this.ctx2d) {
            this.ctx2d.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        }

        // Update matrices for camera view
        this.updateMatrices();

        // Update star positions based on current time
        if (this.stars) {
            this.updateStarData(this.stars, currentTime);
        }

        // Draw elements based on visibility settings
        if (this.visibility.showGrid && this.gridLines) {
            this.drawGrid(this.projectionType);
        }

        if (this.visibility.showStars && this.stars) {
            this.drawStars();
        }

        if ((this.visibility.showNebulae || this.visibility.showGalaxies || this.visibility.showClusters) && this.deepSkyObjects) {
            this.drawDeepSkyObjects();
        }

        if (this.visibility.showMeteors && this.meteorShowers) {
            this.drawMeteorShowers();
        }

        // Draw 3D cardinal directions
        this.draw3DCardinalDirections();

        // Draw connection lines for all active stars and update their positions
        if (this.activeStars.size > 0) {
            const ctx = this.ctx2d;
            const canvasRect = this.canvas.getBoundingClientRect();

            this.activeStars.forEach((info, starId) => {
                // Get the current transformed position of the star
                const transformedStar = this.transformStarsForProjection([info.star], this.projectionType, currentTime)[0];
                const starPos = this.projectPoint(transformedStar);
                
                if (starPos) {
                    // Update info window position to follow star if it's near the edge
                    const windowRect = info.infoWindow.getBoundingClientRect();
                    const canvasWidth = this.canvas.width;
                    const canvasHeight = this.canvas.height;
                    
                    // Check if star is near canvas edge
                    const edgeMargin = 100;
                    if (starPos.x < edgeMargin || starPos.x > canvasWidth - edgeMargin ||
                        starPos.y < edgeMargin || starPos.y > canvasHeight - edgeMargin) {
                        
                        // Calculate new window position that keeps it visible
                        let newLeft = parseFloat(info.infoWindow.style.left);
                        let newTop = parseFloat(info.infoWindow.style.top);
                        
                        if (starPos.x < edgeMargin) newLeft = starPos.x + 20;
                        if (starPos.x > canvasWidth - edgeMargin) newLeft = starPos.x - windowRect.width - 20;
                        if (starPos.y < edgeMargin) newTop = starPos.y + 20;
                        if (starPos.y > canvasHeight - edgeMargin) newTop = starPos.y - windowRect.height - 20;
                        
                        // Keep window within canvas bounds
                        newLeft = Math.max(0, Math.min(newLeft, canvasWidth - windowRect.width));
                        newTop = Math.max(0, Math.min(newTop, canvasHeight - windowRect.height));
                        
                        info.infoWindow.style.left = `${newLeft}px`;
                        info.infoWindow.style.top = `${newTop}px`;
                    }

                    // Draw connection line
                    const infoRect = info.infoWindow.getBoundingClientRect();
                    const infoLeft = infoRect.left - canvasRect.left;
                    const infoTop = infoRect.top - canvasRect.top;
                    const infoRight = infoLeft + infoRect.width;
                    const infoBottom = infoTop + infoRect.height;

                    // Calculate the closest point on the info window border to the star
                    const starX = starPos.x;
                    const starY = starPos.y;

                    // Find the closest point on each edge of the info window
                    let closestPoint = { x: 0, y: 0 };
                    let minDistance = Infinity;

                    // Helper function to find closest point on a line segment
                    const findClosestPointOnLine = (x1, y1, x2, y2) => {
                        const A1 = x2 - x1;
                        const B1 = y2 - y1;
                        const C1 = (x2 - x1) * x1 + (y2 - y1) * y1;
                        const C2 = -B1 * starX + A1 * starY;
                        const det = A1 * A1 + B1 * B1;
                        let cx = 0;
                        let cy = 0;

                        if (det !== 0) {
                            cx = (A1 * C1 - B1 * C2) / det;
                            cy = (A1 * C2 + B1 * C1) / det;
                        } else {
                            cx = x1;
                            cy = y1;
                        }

                        // Check if the point lies beyond the segment endpoints
                        const minX = Math.min(x1, x2);
                        const maxX = Math.max(x1, x2);
                        const minY = Math.min(y1, y2);
                        const maxY = Math.max(y1, y2);

                        cx = Math.max(minX, Math.min(cx, maxX));
                        cy = Math.max(minY, Math.min(cy, maxY));

                        return { x: cx, y: cy };
                    };

                    // Check each edge of the info window
                    const edges = [
                        { x1: infoLeft, y1: infoTop, x2: infoRight, y2: infoTop },       // Top
                        { x1: infoRight, y1: infoTop, x2: infoRight, y2: infoBottom },   // Right
                        { x1: infoRight, y1: infoBottom, x2: infoLeft, y2: infoBottom }, // Bottom
                        { x1: infoLeft, y1: infoBottom, x2: infoLeft, y2: infoTop }      // Left
                    ];

                    edges.forEach(edge => {
                        const point = findClosestPointOnLine(edge.x1, edge.y1, edge.x2, edge.y2);
                        const distance = Math.hypot(starX - point.x, starY - point.y);
                        
                        if (distance < minDistance) {
                            minDistance = distance;
                            closestPoint = point;
                        }
                    });

                    // Draw the connection line
                    ctx.beginPath();
                    ctx.setLineDash([5, 5]);
                    ctx.moveTo(starX, starY);
                    ctx.lineTo(closestPoint.x, closestPoint.y);
                    ctx.strokeStyle = '#666';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });
        }

        // Draw version info and credits after everything else
        this.drawVersionInfo();
    }

    updateMatrices() {
        if (this.projectionType === 'spherical') {
            // 3D projection matrix for spherical view
            const fieldOfView = 60 * Math.PI / 180;
            const aspect = this.gl.canvas.clientWidth / this.gl.canvas.clientHeight;
            const zNear = 0.1;
            const zFar = 100.0;
            
            const projectionMatrix = mat4.create();
            mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

            const modelViewMatrix = mat4.create();
            mat4.identity(modelViewMatrix);
            mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -2.0]);
            mat4.rotate(modelViewMatrix, modelViewMatrix, this.rotation.x, [1, 0, 0]);
            mat4.rotate(modelViewMatrix, modelViewMatrix, this.rotation.y, [0, 1, 0]);
            mat4.scale(modelViewMatrix, modelViewMatrix, [this.zoom, this.zoom, this.zoom]);

            this.modelViewMatrix = modelViewMatrix;
            this.projectionMatrix = projectionMatrix;
        } else {
            // Orthographic projection matrix for flat projections
            const width = this.gl.canvas.clientWidth;
            const height = this.gl.canvas.clientHeight;
            const aspect = width / height;
            
            // Calculate view dimensions based on scale
            const viewWidth = 4.0;
            const viewHeight = viewWidth / aspect;
            
            const projectionMatrix = mat4.create();
            mat4.ortho(projectionMatrix, 
                -viewWidth/2, viewWidth/2,
                -viewHeight/2, viewHeight/2,
                -1, 1);

            const modelViewMatrix = mat4.create();
            mat4.identity(modelViewMatrix);
            
            // Apply scale first
            mat4.scale(modelViewMatrix, modelViewMatrix, [this.scale, this.scale, 1]);
            
            // Apply pan
            if (this.projectionType !== 'mercator') {
                // For non-Mercator projections, apply pan normally
            mat4.translate(modelViewMatrix, modelViewMatrix, [this.pan.x / this.scale, this.pan.y / this.scale, 0]);
            } else {
                // For Mercator, only apply vertical pan
                mat4.translate(modelViewMatrix, modelViewMatrix, [0, this.pan.y / this.scale, 0]);
            }

            this.modelViewMatrix = modelViewMatrix;
            this.projectionMatrix = projectionMatrix;
        }

        this.currentModelView = this.modelViewMatrix;
        this.currentProjection = this.projectionMatrix;
    }

    drawGrid(type) {
        if (!this.gridLines || !this.ctx2d) return;
        
        const ctx = this.ctx2d;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Transform grid lines based on projection type
        this.gridLines.forEach(line => {
            // Check visibility for each grid type
            if (line.type === 'equatorial' && !this.visibility.showEquatorial) return;
            if (line.type === 'galactic' && !this.visibility.showGalactic) return;
            if (line.type === 'azimuthal' && !this.visibility.showAzimuthal) return;
            if (line.type === 'ecliptic' && !this.visibility.showEcliptic) return;

            ctx.beginPath();
            ctx.strokeStyle = line.color;
            ctx.lineWidth = 1;
            
            let first = true;
            let lastPos = null;
            let lastPoint = null;
            
            line.points.forEach((point, index) => {
                // Transform point based on projection type and coordinate system
                let transformedPoint;
                
                if (type !== 'spherical') {
                    // Convert to equatorial coordinates first if needed
                    let eqCoords;
                    if (line.type === 'galactic' && 'l' in point && 'b' in point) {
                        eqCoords = this.galacticToCartesian(point.l, point.b);
                    } else if (line.type === 'azimuthal' && 'az' in point && 'alt' in point) {
                        eqCoords = this.azimuthalToCartesian(point.az, point.alt);
                    } else {
                        eqCoords = this.equatorialToCartesian(point.ra, point.dec);
                    }
                    
                    // Then apply the projection
                    switch(type) {
                        case 'stereographic':
                            transformedPoint = this.equatorialToStereographic(
                                Math.atan2(eqCoords.y, eqCoords.x) * 12 / Math.PI,
                                Math.asin(eqCoords.z) * 180 / Math.PI
                            );
                            break;
                        case 'mercator':
                            transformedPoint = this.equatorialToMercator(
                                Math.atan2(eqCoords.y, eqCoords.x) * 12 / Math.PI,
                                Math.asin(eqCoords.z) * 180 / Math.PI
                            );
                            break;
                        case 'hammer':
                            transformedPoint = this.equatorialToHammer(
                                Math.atan2(eqCoords.y, eqCoords.x) * 12 / Math.PI,
                                Math.asin(eqCoords.z) * 180 / Math.PI
                            );
                            break;
                    }
                } else {
                    transformedPoint = point;
                }
                
                // Project point to screen space
                const pos = this.projectPoint(transformedPoint);
                if (pos) {
                    if (first) {
                        ctx.moveTo(pos.x, pos.y);
                        first = false;
                    } else {
                        // Check for line segment culling conditions
                        let shouldDraw = true;
                        
                        if (lastPos) {
                            const dx = pos.x - lastPos.x;
                            const dy = pos.y - lastPos.y;
                            const distance = Math.sqrt(dx * dx + dy * dy);
                            const canvasWidth = this.canvas.width;
                            const canvasHeight = this.canvas.height;
                            
                            if (type === 'hammer') {
                                // Calculate normalized coordinates (-1 to 1)
                                const nx1 = (lastPos.x / canvasWidth) * 2 - 1;
                                const nx2 = (pos.x / canvasWidth) * 2 - 1;
                                const ny1 = (lastPos.y / canvasHeight) * 2 - 1;
                                const ny2 = (pos.y / canvasHeight) * 2 - 1;
                                
                                // Calculate distance from center for both points
                                const r1 = Math.sqrt(nx1 * nx1 + ny1 * ny1);
                                const r2 = Math.sqrt(nx2 * nx2 + ny2 * ny2);
                                
                                // Don't draw if:
                                // 1. Either point is outside the valid projection area
                                // 2. Line segment is too long (indicates wrapping)
                                // 3. Points are on opposite sides of the projection
                                const edgeThreshold = 1.15; // Increased from 0.95 to allow lines closer to edge
                                if (r1 > edgeThreshold || r2 > edgeThreshold || 
                                    distance > canvasWidth * 0.4 || // Increased from 0.3 to allow longer lines
                                    (nx1 * nx2 < 0 && Math.abs(dx) > canvasWidth * 0.4)) {
                                    shouldDraw = false;
                                }
                            } else if (type === 'mercator') {
                                // For Mercator, check horizontal wrapping
                                if (Math.abs(dx) > canvasWidth * 0.8) {
                                    shouldDraw = false;
                                }
                            }
                        }
                        
                        if (shouldDraw) {
                        ctx.lineTo(pos.x, pos.y);
                        } else {
                            ctx.stroke();
                            ctx.beginPath();
                            ctx.moveTo(pos.x, pos.y);
                    }
                    }
                    lastPos = pos;
                    lastPoint = point;
                }
            });
            
            ctx.stroke();

            // Draw special points for ecliptic
            if (line.type === 'ecliptic') {
                const specialPoints = [
                    // Cardinal points of the ecliptic
                    { name: 'Vernal Equinox (First Point of Aries)', lon: 0, color: 'rgba(0, 255, 0, 0.8)' },    
                    { name: 'Summer Solstice (First Point of Cancer)', lon: 90, color: 'rgba(255, 255, 0, 0.8)' },  
                    { name: 'Autumnal Equinox (First Point of Libra)', lon: 180, color: 'rgba(0, 255, 0, 0.8)' },   
                    { name: 'Winter Solstice (First Point of Capricorn)', lon: 270, color: 'rgba(255, 255, 0, 0.8)' },
                    
                    // Additional ecliptic points
                    { name: 'First Point of Taurus', lon: 30, color: 'rgba(200, 200, 200, 0.8)' },
                    { name: 'First Point of Gemini', lon: 60, color: 'rgba(200, 200, 200, 0.8)' },
                    { name: 'First Point of Leo', lon: 120, color: 'rgba(200, 200, 200, 0.8)' },
                    { name: 'First Point of Virgo', lon: 150, color: 'rgba(200, 200, 200, 0.8)' },
                    { name: 'First Point of Scorpius', lon: 210, color: 'rgba(200, 200, 200, 0.8)' },
                    { name: 'First Point of Sagittarius', lon: 240, color: 'rgba(200, 200, 200, 0.8)' },
                    { name: 'First Point of Aquarius', lon: 300, color: 'rgba(200, 200, 200, 0.8)' },
                    { name: 'First Point of Pisces', lon: 330, color: 'rgba(200, 200, 200, 0.8)' }
                ];

                specialPoints.forEach(point => {
                    const lonRad = point.lon * Math.PI / 180;
                    const sinDec = Math.sin(23.4367 * Math.PI / 180) * Math.sin(lonRad);
                    const dec = Math.asin(sinDec);
                    const ra = Math.atan2(
                        Math.cos(23.4367 * Math.PI / 180) * Math.sin(lonRad),
                        Math.cos(lonRad)
                    );
                    
                    const raHours = ((ra * 12 / Math.PI) + 24) % 24;
                    const decDeg = dec * 180 / Math.PI;
                    
                    let coords = this.equatorialToCartesian(raHours, decDeg);
                    
                    if (type !== 'spherical') {
                        switch(type) {
                            case 'stereographic':
                                coords = this.equatorialToStereographic(raHours, decDeg);
                                break;
                            case 'mercator':
                                coords = this.equatorialToMercator(raHours, decDeg);
                                break;
                            case 'hammer':
                                coords = this.equatorialToHammer(raHours, decDeg);
                                break;
                        }
                    }
                    
                    const pos = this.projectPoint(coords);
                    if (pos) {
                        // Draw star symbol
                        ctx.beginPath();
                        const starSize = 4;
                        for (let i = 0; i < 5; i++) {
                            const angle = (i * 4 * Math.PI / 5) - Math.PI / 2;
                            const x = pos.x + Math.cos(angle) * starSize;
                            const y = pos.y + Math.sin(angle) * starSize;
                            if (i === 0) {
                                ctx.moveTo(x, y);
                            } else {
                                ctx.lineTo(x, y);
                            }
                        }
                        ctx.closePath();
                        ctx.fillStyle = point.color;
                        ctx.fill();
                        
                        // Add hover area for the point
                        const hoverArea = {
                            x: pos.x - starSize * 2,
                            y: pos.y - starSize * 2,
                            width: starSize * 4,
                            height: starSize * 4,
                            point: point
                        };
                        
                        // Store hover area for later use
                        if (!this.hoverAreas) this.hoverAreas = [];
                        this.hoverAreas.push(hoverArea);
                    }
                });
            }
        });
    }

    projectPoint(point) {
        // Create point matrix
        const pos = vec4.fromValues(point.x, point.y, point.z, 1.0);
        
        // Transform point
        vec4.transformMat4(pos, pos, this.currentModelView);
        vec4.transformMat4(pos, pos, this.currentProjection);
        
        // Perspective divide
        if (pos[3] <= 0) return null;
        const x = (pos[0] / pos[3] + 1) * this.gl.canvas.width / 2;
        const y = (-pos[1] / pos[3] + 1) * this.gl.canvas.height / 2;
        
        return { x, y };
    }

    transformStarsForProjection(stars, type, currentTime = new Date()) {
        if (!stars || stars.length === 0) return [];

        // Calculate Earth's rotation based on UTC time
        const utcHours = currentTime.getUTCHours();
        const utcMinutes = currentTime.getUTCMinutes();
        const utcSeconds = currentTime.getUTCSeconds();
        const utcMillis = currentTime.getUTCMilliseconds();
        
        // Convert time to decimal hours
        const totalHours = utcHours + (utcMinutes / 60) + (utcSeconds / 3600) + (utcMillis / 3600000);
        
        // Calculate Earth's rotation angle (15 degrees per hour)
        const earthRotationAngle = (totalHours * 15) * (Math.PI / 180);
        
        return stars.map(star => {
            // First rotate the star based on Earth's rotation
            const rotatedRA = star.ra + (earthRotationAngle * 12 / Math.PI); // Convert radians to hours
            
            // Then apply projection
            let coords;
            switch(type) {
                case 'stereographic':
                    coords = this.equatorialToStereographic(rotatedRA, star.dec);
                    break;
                case 'mercator':
                    coords = this.equatorialToMercator(rotatedRA, star.dec);
                    break;
                case 'hammer':
                    coords = this.equatorialToHammer(rotatedRA, star.dec);
                    break;
                default:
                    // For spherical projection, calculate 3D coordinates with rotated RA
                    const raRad = rotatedRA * Math.PI / 12; // Convert hours to radians
                    const decRad = star.dec * Math.PI / 180; // Convert degrees to radians
                    coords = {
                        x: Math.cos(decRad) * Math.cos(raRad),
                        y: Math.cos(decRad) * Math.sin(raRad),
                        z: Math.sin(decRad)
                    };
            }
            return { ...star, ...coords };
        });
    }

    equatorialToStereographic(ra, dec) {
        // Stereographic projection
        const raRad = (ra * 15) * Math.PI / 180;  // Convert hours to degrees, then to radians
        const decRad = dec * Math.PI / 180;
        
        // Calculate x and y using stereographic projection formulas
        const cosDec = Math.cos(decRad);
        const k = 2.0 / (1.0 + cosDec * Math.cos(raRad));
        
        return {
            x: k * cosDec * Math.sin(raRad),
            y: k * Math.sin(decRad),
            z: 0
        };
    }

    equatorialToMercator(ra, dec) {
        // Handle wrapping for Mercator projection
        let normalizedRA = ra * 15; // Convert hours to degrees
        
        // For Mercator, apply the pan.x offset before normalization
        if (this.projectionType === 'mercator') {
            normalizedRA = normalizedRA - (this.pan.x * 180 / Math.PI);
        }
        
        // Normalize to [0, 360] range
        normalizedRA = ((normalizedRA % 360) + 360) % 360;
        
        // Convert to radians and shift to [-180, 180] range
        const raRad = (normalizedRA - 180) * Math.PI / 180;
        const decRad = Math.max(Math.min(dec * Math.PI / 180, 1.4835), -1.4835); // Limit to ~85 degrees

        return {
            x: raRad,
            y: Math.log(Math.tan(Math.PI/4 + decRad/2)),
            z: 0
        };
    }

    equatorialToHammer(ra, dec) {
        // Normalize RA to handle wrapping
        let normalizedRA = ra * 15; // Convert hours to degrees
        while (normalizedRA > 360) normalizedRA -= 360;
        while (normalizedRA < 0) normalizedRA += 360;
        
        // Apply rotation around polar axis for Hammer projection
        if (this.projectionType === 'hammer' && this.hammerRotation !== 0) {
            normalizedRA = (normalizedRA + (this.hammerRotation * 180 / Math.PI)) % 360;
        }
        
        // Convert to radians, centered on 0
        const raRad = ((normalizedRA + 180) % 360 - 180) * Math.PI / 180;
        const decRad = dec * Math.PI / 180;
        
        const alphaPrime = raRad / 2;
        const cosAlpha = Math.cos(alphaPrime);
        const cosDec = Math.cos(decRad);
        const sinDec = Math.sin(decRad);
        
        // Calculate denominator first to avoid division by zero
        const denom = Math.sqrt(1 + cosDec * cosAlpha);
        if (denom === 0) return { x: 0, y: 0, z: 0 };
        
        // Apply Hammer-Aitoff projection formulas
        return {
            x: 2 * Math.sqrt(2) * cosDec * Math.sin(alphaPrime) / denom,
            y: Math.sqrt(2) * sinDec / denom,
            z: 0
        };
    }

    initGrid() {
        // Create grid lines array
        this.gridLines = [];
        
        // Equatorial grid (blue)
        // Declination lines (parallels)
        for (let dec = -80; dec <= 80; dec += 20) {
            const points = [];
            for (let ra = 0; ra <= 24; ra += 0.25) {
                const coords = this.equatorialToCartesian(ra, dec);
                points.push({
                    ...coords,
                    ra: ra,
                    dec: dec
                });
            }
            this.gridLines.push({
                points,
                color: 'rgba(50, 50, 150, 0.3)',
                type: 'equatorial'
            });
        }

        // Special green meridian at RA = 0h (vernal equinox)
        const greenMeridianPoints = [];
        for (let dec = -90; dec <= 90; dec += 2) {
            const coords = this.equatorialToCartesian(0, dec);
            greenMeridianPoints.push({
                ...coords,
                ra: 0,
                dec: dec
            });
        }
        this.gridLines.push({
            points: greenMeridianPoints,
            color: 'rgba(0, 255, 0, 0.5)',
            type: 'equatorial'
        });
        
        // Right ascension lines (meridians)
        for (let ra = 2; ra < 24; ra += 2) {
            const points = [];
            for (let dec = -90; dec <= 90; dec += 5) {
                const coords = this.equatorialToCartesian(ra, dec);
                points.push({
                    ...coords,
                    ra: ra,
                    dec: dec
                });
            }
            this.gridLines.push({
                points,
                color: 'rgba(50, 50, 150, 0.3)',
                type: 'equatorial'
            });
        }

        // Ecliptic line (yellow)
        const eclipticPoints = [];
        const obliquity = 23.4367 * Math.PI / 180; // Earth's axial tilt in radians
        
        // Calculate ecliptic points using proper spherical geometry
        for (let lon = 0; lon <= 360; lon += 2) {
            const lonRad = lon * Math.PI / 180;
            
            // Convert ecliptic coordinates to equatorial
            const sinDec = Math.sin(obliquity) * Math.sin(lonRad);
            const dec = Math.asin(sinDec);
            const ra = Math.atan2(
                Math.cos(obliquity) * Math.sin(lonRad),
                Math.cos(lonRad)
            );
            
            // Convert to hours for RA
            const raHours = ((ra * 12 / Math.PI) + 24) % 24;
            const decDeg = dec * 180 / Math.PI;
            
            const coords = this.equatorialToCartesian(raHours, decDeg);
            eclipticPoints.push({
                ...coords,
                ra: raHours,
                dec: decDeg
            });
        }
        
        this.gridLines.push({
            points: eclipticPoints,
            color: 'rgba(255, 255, 0, 0.5)',
            type: 'ecliptic'
        });

        // Galactic grid (red)
        // Galactic latitude lines
        for (let b = -75; b <= 75; b += 15) {
            const points = [];
            for (let l = 0; l <= 360; l += 5) {
                const coords = this.galacticToCartesian(l, b);
                points.push({
                    ...coords,
                    l: l,
                    b: b
                });
            }
            this.gridLines.push({
                points,
                color: 'rgba(150, 50, 50, 0.3)',
                type: 'galactic'
            });
        }

        // Galactic longitude lines
        for (let l = 0; l < 360; l += 30) {
            const points = [];
            for (let b = -90; b <= 90; b += 5) {
                const coords = this.galacticToCartesian(l, b);
                points.push({
                    ...coords,
                    l: l,
                    b: b
                });
            }
            this.gridLines.push({
                points,
                color: 'rgba(150, 50, 50, 0.3)',
                type: 'galactic'
            });
        }

        // Special line for galactic equator
        const galacticEquatorPoints = [];
        for (let l = 0; l <= 360; l += 2) {
            const coords = this.galacticToCartesian(l, 0);
            galacticEquatorPoints.push({
                ...coords,
                l: l,
                b: 0
            });
        }
        this.gridLines.push({
            points: galacticEquatorPoints,
            color: 'rgba(255, 100, 100, 0.5)',
            type: 'galactic'
        });

        // Azimuthal grid (green)
        // Altitude lines
        for (let alt = 0; alt <= 90; alt += 15) {
            const points = [];
            for (let az = 0; az <= 360; az += 5) {
                const coords = this.azimuthalToCartesian(az, alt);
                points.push({
                    ...coords,
                    az: az,
                    alt: alt
                });
            }
            this.gridLines.push({
                points,
                color: 'rgba(50, 150, 50, 0.3)',
                type: 'azimuthal'
            });
        }

        // Azimuth lines
        for (let az = 0; az < 360; az += 30) {
            const points = [];
            for (let alt = 0; alt <= 90; alt += 5) {
                const coords = this.azimuthalToCartesian(az, alt);
                points.push({
                    ...coords,
                    az: az,
                    alt: alt
                });
            }
            this.gridLines.push({
                points,
                color: 'rgba(50, 150, 50, 0.3)',
                type: 'azimuthal'
            });
        }
    }

    galacticToCartesian(l, b) {
        // Convert galactic coordinates to equatorial
        const lRad = l * Math.PI / 180;
        const bRad = b * Math.PI / 180;
        
        // Galactic pole in equatorial coordinates (J2000)
        const alphaGP = 192.859508 * Math.PI / 180;  // RA of galactic north pole
        const deltaGP = 27.128336 * Math.PI / 180;   // Dec of galactic north pole
        const lCP = 122.932 * Math.PI / 180;         // Galactic longitude of celestial pole
        
        // Calculate equatorial coordinates
        const sinb = Math.sin(bRad);
        const cosb = Math.cos(bRad);
        const sinlcp_l = Math.sin(lCP - lRad);
        const coslcp_l = Math.cos(lCP - lRad);
        
        const sindelta = sinb * Math.sin(deltaGP) + cosb * Math.cos(deltaGP) * coslcp_l;
        const delta = Math.asin(sindelta);
        
        const y = cosb * sinlcp_l;
        const x = sinb * Math.cos(deltaGP) - cosb * Math.sin(deltaGP) * coslcp_l;
        const alpha = alphaGP - Math.atan2(y, x);
        
        // Convert to cartesian coordinates
        return {
            x: Math.cos(delta) * Math.cos(alpha),
            y: Math.cos(delta) * Math.sin(alpha),
            z: Math.sin(delta)
        };
    }

    azimuthalToCartesian(az, alt) {
        // Convert azimuth and altitude to equatorial coordinates
        // This is a simplified version that assumes the observer is at the equator
        // For real implementation, we would need the observer's latitude and longitude
        const azRad = az * Math.PI / 180;
        const altRad = alt * Math.PI / 180;
        
        return {
            x: Math.cos(altRad) * Math.sin(azRad),
            y: Math.cos(altRad) * Math.cos(azRad),
            z: Math.sin(altRad)
        };
    }

    equatorialToCartesian(ra, dec) {
        const raRad = ra * Math.PI / 12;  // Convert hours to radians
        const decRad = dec * Math.PI / 180;  // Convert degrees to radians
        return {
            x: Math.cos(decRad) * Math.cos(raRad),
            y: Math.cos(decRad) * Math.sin(raRad),
            z: Math.sin(decRad)
        };
    }

    spectralTypeToRGB(spectralType) {
        if (!spectralType) return [1, 1, 1];
        
        const type = spectralType.charAt(0).toUpperCase();
        
        // More pronounced color differences
        switch (type) {
            case 'O':  // Hot blue stars (30,000-60,000K)
                return [0.4, 0.4, 1.0]; 
            case 'B':  // Blue to blue-white (10,000-30,000K)
                return [0.5, 0.7, 1.0]; 
            case 'A':  // White (7,500-10,000K)
                return [1.0, 1.0, 1.0];
            case 'F':  // Yellow-white (6,000-7,500K)
                return [1.0, 0.9, 0.7];
            case 'G':  // Yellow (5,000-6,000K)
                return [1.0, 0.8, 0.4];
            case 'K':  // Orange (3,500-5,000K)
                return [1.0, 0.6, 0.2];
            case 'M':  // Red (2,000-3,500K)
                return [1.0, 0.2, 0.2];
            default:
                return [1.0, 1.0, 1.0];  // Default to white
        }
    }
    
    colorIndexToRGB(colorIndex) {
        if (typeof colorIndex !== 'number') return [1, 1, 1];
        let r = 1.0;
        let g = 1.0;
        let b = 1.0;
        
        if (colorIndex < 0) {
            // Bluer stars - more pronounced blue
            g = Math.max(0.2, 1.0 + colorIndex * 1.2);
            r = Math.max(0.1, g * 0.5);
            // Redder stars - more pronounced red
            b = Math.max(0.0, 1.0 - colorIndex);      
            g = Math.max(0.0, 1.0 - colorIndex * 0.8);
        }
        
        return [
            Math.max(0, Math.min(1, r)),
            Math.max(0, Math.min(1, g)),
            Math.max(0, Math.min(1, b))
        ];
    }

    // Add this method to the SkyRenderer class for 3D cardinal directions
    draw3DCardinalDirections() {
        const ctx = this.gl; // Assuming you're using WebGL context for 3D rendering
        const positions = [
            { label: 'N', x: 0, y: 1, z: 0 },
            { label: 'NE', x: 0.707, y: 0.707, z: 0 },
            { label: 'E', x: 1, y: 0, z: 0 },
            { label: 'SE', x: 0.707, y: -0.707, z: 0 },
            { label: 'S', x: 0, y: -1, z: 0 },
            { label: 'SW', x: -0.707, y: -0.707, z: 0 },
            { label: 'W', x: -1, y: 0, z: 0 },
            { label: 'NW', x: -0.707, y: 0.707, z: 0 } 
        ];

        positions.forEach(pos => {
            this.render3DLabel(pos.label, pos.x, pos.y, pos.z);
        });
    }

    // Add this method to the SkyRenderer class for rendering 3D labels
    render3DLabel(label, x, y, z) {
        // Implement the logic to render the label in 3D space
        // This could involve setting up a 3D text rendering system or using a sprite
        // For example, using a 3D canvas or a library like three.js
        // Placeholder for actual rendering logic
        const ctx = this.ctx2d;
        const pos = this.projectPoint({ x, y, z });
        if (pos) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(label, pos.x, pos.y);
        }
    }

    createDisplayOptions() {
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '12px';

        // Create sections for controls
        const sections = [
            {
                title: 'Grid Systems',
                controls: [
                    { id: 'showEquatorial', symbol: '⊕', tooltip: 'Equatorial Grid' },
                    { id: 'showGalactic', symbol: '⊗', tooltip: 'Galactic Grid' },
                    { id: 'showAzimuthal', symbol: '⊙', tooltip: 'Azimuthal Grid' },
                    { id: 'showEcliptic', symbol: '⊚', tooltip: 'Ecliptic Line' }
                ]
            },
            {
                title: 'Celestial Objects',
                controls: [
                    { id: 'showStars', symbol: '★', tooltip: 'Stars' },
                    { id: 'showConstellations', symbol: '⋆', tooltip: 'Constellations' },
                    { id: 'showMeteors', symbol: '☄', tooltip: 'Meteor Showers' }
                ]
            },
            {
                title: 'Deep Sky Objects',
                controls: [
                    { id: 'showNebulae', symbol: '◊', tooltip: 'Nebulae' },
                    { id: 'showGalaxies', symbol: '∞', tooltip: 'Galaxies' },
                    { id: 'showClusters', symbol: '⋇', tooltip: 'Star Clusters' }
                ]
            },
            {
                title: 'Labels & Info',
                controls: [
                    { id: 'showLabels', symbol: '⚏', tooltip: 'Object Labels' }
                ]
            }
        ];

        // Create a row for each section
        sections.forEach(section => {
            const sectionDiv = document.createElement('div');
            sectionDiv.style.display = 'flex';
            sectionDiv.style.flexDirection = 'row';
            sectionDiv.style.gap = '8px';
            sectionDiv.style.justifyContent = 'center';
            sectionDiv.style.alignItems = 'center';
            sectionDiv.style.padding = '4px';
            sectionDiv.style.borderBottom = '1px solid #444';

            section.controls.forEach(control => {
                const button = document.createElement('button');
                button.className = 'xeron-button';
                button.style.width = '40px';
                button.style.height = '40px';
                button.style.fontSize = '20px';
                button.style.padding = '8px';
                button.style.backgroundColor = this.visibility[control.id] ? '#444' : '#222';
                button.style.color = '#fff';
                button.style.border = '1px solid #444';
                button.style.borderRadius = '3px';
                button.style.cursor = 'pointer';
                button.style.display = 'flex';
                button.style.alignItems = 'center';
                button.style.justifyContent = 'center';
                button.innerHTML = control.symbol;
                button.title = control.tooltip;

                button.addEventListener('click', () => {
                    this.visibility[control.id] = !this.visibility[control.id];
                    button.style.backgroundColor = this.visibility[control.id] ? '#444' : '#222';
                    this.render();
                });

                sectionDiv.appendChild(button);
            });

            container.appendChild(sectionDiv);
        });

        return container;
    }
} 

