class NightSky {
    constructor() {
        this.canvas = document.getElementById('skyCanvas');
        this.renderer = new SkyRenderer(this.canvas);
        this.starData = new StarData();
        this.animationFrameId = null;
        
        // Initialize time control
        this.timeSpeed = 1; // 1 = real time, 2 = 2x speed, -1 = reverse, etc.
        this.currentTime = new Date();
        this.lastFrameTime = performance.now();
        
        // Create time control UI
        this.createTimeControls();
        
        // Initialize the application
        this.init().catch(error => {
            console.error('Failed to initialize NightSky:', error);
            this.displayError('Failed to initialize sky visualization. Please refresh the page.');
        });
    }

    createTimeControls() {
        const controls = document.createElement('div');
        controls.style.position = 'absolute';
        controls.style.bottom = '20px';
        controls.style.left = '50%';
        controls.style.transform = 'translateX(-50%)';
        controls.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        controls.style.padding = '10px';
        controls.style.borderRadius = '5px';
        controls.style.display = 'flex';
        controls.style.gap = '10px';
        controls.style.alignItems = 'center';
        controls.style.zIndex = '1000';

        // Rewind button
        const rewindBtn = document.createElement('button');
        rewindBtn.innerHTML = '⇤';
        rewindBtn.onclick = () => {
            if (this.timeSpeed >= 0) {
                this.timeSpeed = -60;
            } else {
                this.timeSpeed *= 2; // Double the current reverse speed
            }
        };
        this.styleButton(rewindBtn);

        // Play/Pause button
        const playPauseBtn = document.createElement('button');
        playPauseBtn.innerHTML = '⏸';
        playPauseBtn.style.width = '40px'; // Fixed width for better centering
        playPauseBtn.onclick = () => {
            this.timeSpeed = this.timeSpeed !== 0 ? 0 : 1;
            playPauseBtn.innerHTML = this.timeSpeed === 0 ? '▶' : '⏸';
        };
        this.styleButton(playPauseBtn);

        // Fast forward button
        const ffwdBtn = document.createElement('button');
        ffwdBtn.innerHTML = '⇥';
        ffwdBtn.onclick = () => {
            if (this.timeSpeed <= 0) {
                this.timeSpeed = 60;
            } else {
                this.timeSpeed *= 2; // Double the current forward speed
            }
        };
        this.styleButton(ffwdBtn);

        // Speed display
        const speedDisplay = document.createElement('span');
        speedDisplay.style.color = 'white';
        speedDisplay.style.minWidth = '100px';
        speedDisplay.style.textAlign = 'center';

        // Current time display
        const timeDisplay = document.createElement('span');
        timeDisplay.style.color = 'white';
        timeDisplay.style.minWidth = '200px';
        timeDisplay.style.textAlign = 'center';

        // Reset time button
        const resetBtn = document.createElement('button');
        resetBtn.innerHTML = '⟲';
        resetBtn.style.width = '40px'; // Fixed width for better centering
        resetBtn.onclick = () => {
            this.currentTime = new Date();
            this.timeSpeed = 1;
            playPauseBtn.innerHTML = '⏸';
        };
        this.styleButton(resetBtn);

        // Update displays
        setInterval(() => {
            speedDisplay.textContent = this.timeSpeed === 0 
                ? 'Paused' 
                : `${Math.abs(this.timeSpeed)}x${this.timeSpeed < 0 ? ' (Rev)' : ''}`;
            timeDisplay.textContent = this.currentTime.toUTCString();
        }, 100);

        // Add all elements to controls
        controls.appendChild(rewindBtn);
        controls.appendChild(playPauseBtn);
        controls.appendChild(ffwdBtn);
        controls.appendChild(speedDisplay);
        controls.appendChild(timeDisplay);
        controls.appendChild(resetBtn);

        this.canvas.parentNode.appendChild(controls);
    }

    styleButton(btn) {
        btn.style.backgroundColor = '#333';
        btn.style.color = 'white';
        btn.style.border = 'none';
        btn.style.borderRadius = '3px';
        btn.style.padding = '5px 10px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '16px';
        btn.style.textAlign = 'center';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.minWidth = '30px';
        btn.onmouseover = () => btn.style.backgroundColor = '#444';
        btn.onmouseout = () => btn.style.backgroundColor = '#333';
    }

    displayError(message) {
        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
    }

    async init() {
        console.log('Initializing NightSky...');
        
        try {
            // Load all celestial data
            const data = await this.starData.loadAllData();
            console.log('Loaded celestial data:', data);
            
            // Update renderer with all celestial data
            if (data.stars && data.stars.length > 0) {
                this.renderer.updateStarData(data.stars);
                console.log(`Loaded ${data.stars.length} stars`);
            }

            if (data.deepSkyObjects) {
                this.renderer.updateDeepSkyObjects(data.deepSkyObjects);
                console.log('Loaded deep sky objects:', data.deepSkyObjects);
            }

            if (data.meteorShowers) {
                this.renderer.updateMeteorShowers(data.meteorShowers);
                console.log('Loaded meteor showers:', data.meteorShowers);
            }
            
            // Start the render loop
            this.startRenderLoop();
            
        } catch (error) {
            console.error('Failed to initialize NightSky:', error);
            this.displayError(`Error loading sky: ${error.message}`);
            throw error;
        }
    }

    updateTime() {
        const now = performance.now();
        const deltaTime = (now - this.lastFrameTime) / 1000; // Convert to seconds
        this.lastFrameTime = now;

        // Update current time based on time speed
        const timeChange = deltaTime * this.timeSpeed * 1000; // Convert to milliseconds
        this.currentTime = new Date(this.currentTime.getTime() + timeChange);
    }

    startRenderLoop() {
        console.log('Starting render loop...');
        const animate = () => {
            this.updateTime();
            this.renderer.render(this.currentTime);
            this.animationFrameId = requestAnimationFrame(animate);
        };
        animate();
    }

    cleanup() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }
}

// Initialize the application when the page loads
window.addEventListener('load', () => {
    window.nightSky = new NightSky();
});
