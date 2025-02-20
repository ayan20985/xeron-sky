class NightSky {
    constructor() {
        this.canvas = document.getElementById('skyCanvas');
        this.renderer = new SkyRenderer(this.canvas);
        this.starData = new StarData();
        this.animationFrameId = null;
        
        // Initialize the application
        this.init().catch(error => {
            console.error('Failed to initialize NightSky:', error);
            this.displayError('Failed to initialize sky visualization. Please refresh the page.');
        });
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

    startRenderLoop() {
        console.log('Starting render loop...');
        const animate = () => {
            this.renderer.render();
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
