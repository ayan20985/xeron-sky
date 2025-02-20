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
        controls.className = 'control-panel bottom';

        // Rewind button
        const rewindBtn = document.createElement('button');
        rewindBtn.className = 'xeron-button';
        rewindBtn.innerHTML = '⇤';
        rewindBtn.onclick = () => {
            if (this.timeSpeed >= 0) {
                this.timeSpeed = -2;
            } else {
                this.timeSpeed *= 2;
            }
        };

        // Play/Pause button
        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'xeron-button';
        playPauseBtn.innerHTML = '⏸';
        playPauseBtn.style.width = '40px';
        playPauseBtn.onclick = () => {
            this.timeSpeed = this.timeSpeed !== 0 ? 0 : 1;
            playPauseBtn.innerHTML = this.timeSpeed === 0 ? '▶' : '⏸';
        };

        // Fast forward button
        const ffwdBtn = document.createElement('button');
        ffwdBtn.className = 'xeron-button';
        ffwdBtn.innerHTML = '⇥';
        ffwdBtn.onclick = () => {
            if (this.timeSpeed <= 0) {
                this.timeSpeed = 2;
            } else {
                this.timeSpeed *= 2;
            }
        };

        // Speed display
        const speedDisplay = document.createElement('span');
        speedDisplay.className = 'display-text';

        // Current time display
        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'display-text large';

        // Reset time button
        const resetBtn = document.createElement('button');
        resetBtn.className = 'xeron-button';
        resetBtn.innerHTML = '⟲';
        resetBtn.style.width = '40px';
        resetBtn.onclick = () => {
            this.currentTime = new Date();
            this.timeSpeed = 1;
            playPauseBtn.innerHTML = '⏸';
        };

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
