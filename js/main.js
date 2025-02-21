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
        controls.style.position = 'absolute';
        controls.style.left = '50%';
        controls.style.bottom = '20px';
        controls.style.transform = 'translateX(-50%)';
        controls.style.backgroundColor = '#222';
        controls.style.padding = '10px';
        controls.style.borderRadius = '5px';
        controls.style.zIndex = '0';
        controls.style.transition = 'transform 0.3s ease, border-radius 0.3s ease';
        controls.style.cursor = 'move';
        controls.style.userSelect = 'none';

        // Main controls container
        const mainControls = document.createElement('div');
        mainControls.style.display = 'flex';
        mainControls.style.alignItems = 'center';
        mainControls.style.gap = '8px';
        mainControls.style.position = 'relative';
        mainControls.style.zIndex = '1';

        // Common button styles
        const commonButtonStyle = {
            width: '32px',
            height: '32px',
            fontSize: '16px',
            padding: '4px',
            backgroundColor: '#222',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 2px',
            textAlign: 'center',
            lineHeight: '1'
        };

        // Selection button styles (smaller)
        const selectionButtonStyle = {
            ...commonButtonStyle,
            width: '22px',
            height: '22px',
            fontSize: '11px',
            padding: '2px',
            margin: '0 1px'
        };

        // Add hover behavior function
        const addHoverBehavior = (button, tooltip) => {
            button.addEventListener('mouseenter', (e) => {
                const tooltipDiv = document.createElement('div');
                tooltipDiv.id = 'button-tooltip';
                tooltipDiv.style.position = 'absolute';
                tooltipDiv.style.backgroundColor = '#222';
                tooltipDiv.style.color = '#fff';
                tooltipDiv.style.padding = '5px';
                tooltipDiv.style.border = '1px solid #444';
                tooltipDiv.style.borderRadius = '3px';
                tooltipDiv.style.fontSize = '12px';
                tooltipDiv.style.pointerEvents = 'none';
                tooltipDiv.style.zIndex = '1000';
                tooltipDiv.textContent = tooltip;
                document.body.appendChild(tooltipDiv);

                const rect = button.getBoundingClientRect();
                tooltipDiv.style.left = (rect.left + (rect.width - tooltipDiv.offsetWidth) / 2) + 'px';
                tooltipDiv.style.top = (rect.top - tooltipDiv.offsetHeight - 5) + 'px';
            });

            button.addEventListener('mouseleave', () => {
                const tooltip = document.getElementById('button-tooltip');
                if (tooltip) tooltip.remove();
            });
        };

        // Apply common styles function
        const applyCommonStyles = (button, isSelectionButton = false) => {
            const styles = isSelectionButton ? selectionButtonStyle : commonButtonStyle;
            Object.entries(styles).forEach(([property, value]) => {
                button.style[property] = value;
            });
        };

        // Time control buttons with tooltips
        const rewindBtn = document.createElement('button');
        rewindBtn.className = 'xeron-button';
        rewindBtn.innerHTML = '⇤';
        applyCommonStyles(rewindBtn);
        addHoverBehavior(rewindBtn, 'Rewind Time');
        rewindBtn.onclick = () => {
            if (this.timeSpeed >= 0) {
                this.timeSpeed = -2;
            } else {
                this.timeSpeed *= 2;
            }
        };

        const playPauseBtn = document.createElement('button');
        playPauseBtn.className = 'xeron-button';
        playPauseBtn.innerHTML = '⏸';
        applyCommonStyles(playPauseBtn);
        addHoverBehavior(playPauseBtn, 'Play/Pause');
        playPauseBtn.onclick = () => {
            this.timeSpeed = this.timeSpeed !== 0 ? 0 : 1;
            playPauseBtn.innerHTML = this.timeSpeed === 0 ? '▶' : '⏸';
        };

        const ffwdBtn = document.createElement('button');
        ffwdBtn.className = 'xeron-button';
        ffwdBtn.innerHTML = '⇥';
        applyCommonStyles(ffwdBtn);
        addHoverBehavior(ffwdBtn, 'Fast Forward');
        ffwdBtn.onclick = () => {
            if (this.timeSpeed <= 0) {
                this.timeSpeed = 2;
            } else {
                this.timeSpeed *= 2;
            }
        };

        const speedDisplay = document.createElement('span');
        speedDisplay.className = 'display-text';

        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'display-text large';

        const resetBtn = document.createElement('button');
        resetBtn.className = 'xeron-button';
        resetBtn.innerHTML = '⟲';
        applyCommonStyles(resetBtn);
        addHoverBehavior(resetBtn, 'Reset Time');
        resetBtn.onclick = () => {
            this.currentTime = new Date();
            this.timeSpeed = 1;
            playPauseBtn.innerHTML = '⏸';
        };

        const homeBtn = document.createElement('button');
        homeBtn.className = 'xeron-button';
        homeBtn.innerHTML = '⌂';
        applyCommonStyles(homeBtn);
        homeBtn.style.fontSize = '24px'; // Increase home button icon size
        addHoverBehavior(homeBtn, 'Reset Panel Position');
        homeBtn.onclick = () => {
            controls.style.left = '50%';
            controls.style.bottom = '20px';
            controls.style.transform = 'translateX(-50%)';
        };

        const dropdownBtn = document.createElement('button');
        dropdownBtn.className = 'xeron-button';
        dropdownBtn.innerHTML = '▼';
        applyCommonStyles(dropdownBtn);
        addHoverBehavior(dropdownBtn, 'Toggle Selection Buttons');

        // Create unified button row container
        const buttonRow = document.createElement('div');
        buttonRow.style.position = 'absolute';
        buttonRow.style.left = '50%';
        buttonRow.style.width = 'auto';
        buttonRow.style.transform = 'translate(-50%, -28px)';  // Adjusted to match button height + padding
        buttonRow.style.top = '100%';
        buttonRow.style.display = 'flex';
        buttonRow.style.alignItems = 'center';
        buttonRow.style.justifyContent = 'center';
        buttonRow.style.backgroundColor = '#111';
        buttonRow.style.padding = '3px';
        buttonRow.style.borderRadius = '0 0 3px 3px';
        buttonRow.style.gap = '1px';
        buttonRow.style.transition = 'all 0.3s ease';
        buttonRow.style.opacity = '1';
        buttonRow.style.zIndex = '-1';
        buttonRow.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        buttonRow.style.visibility = 'hidden';

        // Modify the controls container
        controls.style.position = 'absolute';
        controls.style.zIndex = '1000';
        controls.style.backgroundColor = '#222';

        // Add position tracking variables
        let hasBeenMoved = false;
        let isNearBottom = false;

        // Toggle button row visibility with slide animation
        let isButtonRowVisible = false;
        dropdownBtn.onclick = () => {
            isButtonRowVisible = !isButtonRowVisible;
            const controlRect = controls.getBoundingClientRect();
            const windowHeight = window.innerHeight;
            const buttonRowHeight = 28;
            
            // Check if control panel is near bottom of screen
            isNearBottom = (windowHeight - controlRect.bottom) < buttonRowHeight + 20;

            if (!isButtonRowVisible) {
                buttonRow.style.transform = 'translate(-50%, -28px)';  // Match initial transform
                setTimeout(() => {
                    buttonRow.style.visibility = 'hidden';
                }, 300);
                controls.style.borderRadius = '5px';
                dropdownBtn.innerHTML = '▲';
                
                // If not manually moved, animate back to original position
                if (!hasBeenMoved) {
                    controls.style.transition = 'all 0.3s ease';
                    controls.style.left = '50%';
                    controls.style.bottom = '20px';
                    controls.style.transform = 'translateX(-50%)';
                }
            } else {
                buttonRow.style.visibility = 'visible';
                requestAnimationFrame(() => {
                    buttonRow.style.transform = 'translate(-50%, 0)';
                });
                controls.style.borderRadius = '5px 5px 0 0';
                dropdownBtn.innerHTML = '▼';
                
                // If near bottom and not manually moved, move panel up
                if (isNearBottom && !hasBeenMoved) {
                    controls.style.transition = 'all 0.3s ease';
                    controls.style.bottom = `${buttonRowHeight + 20}px`;
                }
            }
        };

        const allControls = [
            // Grid Systems
            { id: 'showEquatorial', symbol: '⊕', tooltip: 'Equatorial Grid' },
            { id: 'showGalactic', symbol: '⊗', tooltip: 'Galactic Grid' },
            { id: 'showAzimuthal', symbol: '⊙', tooltip: 'Azimuthal Grid' },
            { id: 'showEcliptic', symbol: '⊚', tooltip: 'Ecliptic Line' },
            { type: 'separator' },
            // Solar System
            { id: 'showSun', symbol: '☉', tooltip: 'Sun' },
            { id: 'showPlanets', symbol: '♄', tooltip: 'Planets' },
            { id: 'showPlanetOrbits', symbol: '⊛', tooltip: 'Planet Orbits' },
            { type: 'separator' },
            // Celestial Objects
            { id: 'showStars', symbol: '★', tooltip: 'Stars' },
            { id: 'showStarNames', symbol: 'Aa', tooltip: 'Star Names' },
            { id: 'showConstellations', symbol: '⋆', tooltip: 'Constellations' },
            { id: 'showMeteors', symbol: '☄', tooltip: 'Meteor Showers' },
            { type: 'separator' },
            // Deep Sky Objects
            { id: 'showNebulae', symbol: '◊', tooltip: 'Nebulae' },
            { id: 'showGalaxies', symbol: '∞', tooltip: 'Galaxies' },
            { id: 'showClusters', symbol: '⋇', tooltip: 'Star Clusters' },
            { type: 'separator' },
            // Labels
            { id: 'showLabels', symbol: '⚏', tooltip: 'Object Labels' },
            { type: 'separator' },
            // Projections
            { id: 'projection', value: 'spherical', symbol: '◉', tooltip: 'Spherical Projection' },
            { id: 'projection', value: 'stereographic', symbol: '◎', tooltip: 'Stereographic Projection' },
            { id: 'projection', value: 'mercator', symbol: '▭', tooltip: 'Mercator Projection' },
            { id: 'projection', value: 'hammer', symbol: '◗', tooltip: 'Hammer-Aitoff Projection' }
        ];

        allControls.forEach(control => {
            if (control.type === 'separator') {
                const separator = document.createElement('div');
                separator.style.width = '1px';
                separator.style.height = '16px'; // Even smaller height for separators
                separator.style.backgroundColor = '#444';
                separator.style.margin = '0 4px';
                buttonRow.appendChild(separator);
            } else {
                const button = document.createElement('button');
                button.className = 'xeron-button';
                applyCommonStyles(button, true); // Apply selection button styles
                button.innerHTML = control.symbol;
                addHoverBehavior(button, control.tooltip);

                if (control.id === 'projection') {
                    button.style.backgroundColor = control.value === this.renderer.projectionType ? '#444' : '#222';
                    button.addEventListener('click', () => {
                        buttonRow.querySelectorAll('button[data-projection]').forEach(btn => {
                            btn.style.backgroundColor = '#222';
                        });
                        button.style.backgroundColor = '#444';
                        this.renderer.setProjection(control.value);
                    });
                    button.setAttribute('data-projection', control.value);
                } else {
                    button.style.backgroundColor = this.renderer.visibility[control.id] ? '#444' : '#222';
                    button.addEventListener('click', () => {
                        this.renderer.visibility[control.id] = !this.renderer.visibility[control.id];
                        button.style.backgroundColor = this.renderer.visibility[control.id] ? '#444' : '#222';
                        this.renderer.render();
                    });
                }

                buttonRow.appendChild(button);
            }
        });

        // Add all elements to main controls
        mainControls.appendChild(rewindBtn);
        mainControls.appendChild(playPauseBtn);
        mainControls.appendChild(ffwdBtn);
        mainControls.appendChild(speedDisplay);
        mainControls.appendChild(timeDisplay);
        mainControls.appendChild(resetBtn);
        mainControls.appendChild(homeBtn);
        mainControls.appendChild(dropdownBtn);

        controls.appendChild(mainControls);
        controls.appendChild(buttonRow);

        // Update the dragging behavior to include position check
        let isDragging = false;
        let dragStartX, dragStartY;
        let initialLeft, initialBottom;

        controls.addEventListener('mousedown', (e) => {
            if (e.target === controls || e.target === mainControls) {
                isDragging = true;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                const rect = controls.getBoundingClientRect();
                initialLeft = rect.left;
                initialBottom = window.innerHeight - rect.bottom;
                controls.style.cursor = 'grabbing';
                
                // Remove transition when starting drag
                controls.style.transition = 'none';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - dragStartX;
                const deltaY = e.clientY - dragStartY;
                const newLeft = initialLeft + deltaX;
                const newBottom = initialBottom - deltaY;
                controls.style.left = `${newLeft}px`;
                controls.style.bottom = `${newBottom}px`;
                controls.style.transform = 'none';
                hasBeenMoved = true;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            controls.style.cursor = 'move';
        });

        // Update home button to reset movement tracking
        homeBtn.onclick = () => {
            controls.style.transition = 'all 0.3s ease';
            controls.style.left = '50%';
            controls.style.bottom = '20px';
            controls.style.transform = 'translateX(-50%)';
            hasBeenMoved = false;
            
            // If dropdown is open and panel would be too close to bottom, adjust position
            if (isButtonRowVisible && isNearBottom) {
                controls.style.bottom = `${buttonRowHeight + 40}px`;
            }
        };

        // Update displays
        setInterval(() => {
            speedDisplay.textContent = this.timeSpeed === 0 
                ? 'Paused' 
                : `${Math.abs(this.timeSpeed)}x${this.timeSpeed < 0 ? ' (Rev)' : ''}`;
            timeDisplay.textContent = this.currentTime.toUTCString();
        }, 100);

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
