class StarData {
    constructor() {
        this.stars = [];
        this.constellationLines = [];
        this.deepSkyObjects = {
            nebulae: [],
            galaxies: [],
            clusters: []
        };
        this.meteorShowers = [];
        this.activeShowers = [];
        
        // Import common star names from separate file
        import('./commonstardata.js').then(module => {
            this.commonNames = module.commonStarNames;
        }).catch(error => {
            console.warn('Could not load common star names:', error);
            this.commonNames = {};
        });
    }

    async loadAllData() {
        try {
            const yaleData = await this.loadYaleCatalog();
            if (yaleData?.length > 0) {
                console.log(`Loaded ${yaleData.length} stars from Yale catalog`);
                // Fetch common names for bright stars (magnitude < 3)
                const brightStars = yaleData.filter(star => star.magnitude < 3);
                for (const star of brightStars) {
                    try {
                        const commonName = await this.fetchCommonName(star.id);
                        if (commonName) {
                            star.commonName = commonName;
                        }
                    } catch (error) {
                        console.warn(`Could not fetch common name for ${star.id}:`, error);
                    }
                }
                this.stars = yaleData;
            } else {
                throw new Error('No stars loaded from Yale catalog');
            }
            return { stars: this.stars };
        } catch (error) {
            console.error('Error loading astronomical data:', error);
            throw error;
        }
    }

    async loadYaleCatalog() {
        try {
            const tapUrl = 'https://tapvizier.u-strasbg.fr/TAPVizieR/tap/sync';
            const query = `
                SELECT "V/50/catalog"."HR", "RAJ2000", "DEJ2000", "Vmag", "B-V", "SpType", "Name"
                FROM "V/50/catalog"
                WHERE "Vmag" IS NOT NULL
                ORDER BY "Vmag" ASC
            `;
            
            const response = await fetch(`${tapUrl}?${new URLSearchParams({
                request: 'doQuery',
                lang: 'ADQL',
                format: 'json',
                query: query
            })}`);

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (!data?.data) throw new Error('Invalid response from Yale catalog');
            return this.parseVizierData(data);
        } catch (error) {
            console.error('Error fetching Yale catalog:', error);
            throw error;
        }
    }

    parseVizierData(data) {
        if (!data?.data) return [];
        
        return data.data
            .map(star => {
                const ra = parseFloat(star[1]) / 15;
                const dec = parseFloat(star[2]);
                const raRad = ra * Math.PI / 12;
                const decRad = dec * Math.PI / 180;
                const magnitude = parseFloat(star[3]);
                const colorIndex = parseFloat(star[4]);
                const spectralType = star[5]?.trim();

                return {
                    id: `HR ${star[0]}`,
                    name: star[6]?.trim() || `HR ${star[0]}`,
                    ra,
                    dec,
                    magnitude,
                    colorIndex,
                    spectralType,
                    x: Math.cos(decRad) * Math.cos(raRad),
                    y: Math.cos(decRad) * Math.sin(raRad),
                    z: Math.sin(decRad)
                };
            })
            .filter(star => 
                !isNaN(star.x) && !isNaN(star.y) && !isNaN(star.z) && 
                !isNaN(star.magnitude) && !isNaN(star.ra) && !isNaN(star.dec)
            );
    }

    equatorialToCartesian(ra, dec, distance = 1) {
        const raRad = (ra * 15) * Math.PI / 180;
        const decRad = dec * Math.PI / 180;

        return {
            x: distance * Math.cos(decRad) * Math.cos(raRad),
            y: distance * Math.cos(decRad) * Math.sin(raRad),
            z: distance * Math.sin(decRad)
        };
    }

    equatorialToStereographic(ra, dec) {
        const raRad = (ra * 15) * Math.PI / 180;
        const decRad = dec * Math.PI / 180;
        const R = 2.0 / (1.0 + Math.cos(decRad) * Math.cos(raRad));
        
        return {
            x: R * Math.cos(decRad) * Math.sin(raRad),
            y: R * Math.sin(decRad),
            z: 0
        };
    }

    equatorialToMercator(ra, dec) {
        const raRad = (ra * 15) * Math.PI / 180;
        const decRad = Math.max(Math.min(dec * Math.PI / 180, Math.PI/2 - 0.01), -Math.PI/2 + 0.01);
        
        return {
            x: raRad,
            y: Math.log(Math.tan(Math.PI/4 + decRad/2)),
            z: 0
        };
    }

    equatorialToHammer(ra, dec) {
        const raRad = (ra * 15 - 180) * Math.PI / 180;
        const decRad = dec * Math.PI / 180;
        const z = Math.sqrt(1 + Math.cos(decRad) * Math.cos(raRad/2));
        
        return {
            x: 2 * Math.sqrt(2) * Math.cos(decRad) * Math.sin(raRad/2) / z,
            y: Math.sqrt(2) * Math.sin(decRad) / z,
            z: 0
        };
    }

    async loadDeepSkyObjects() {
        const simbadUrl = 'http://simbad.u-strasbg.fr/simbad/sim-tap/sync';
        const query = `SELECT basic.OID, ident.id, ra, dec, allfluxes.V, otype.otype_txt, dim.dimensions
                      FROM basic
                      JOIN ident ON ident.oidref = basic.OID
                      LEFT JOIN allfluxes ON allfluxes.oidref = basic.OID
                      JOIN otype ON otype.otype = basic.otype
                      LEFT JOIN dim ON dim.oidref = basic.OID
                      WHERE ident.id LIKE 'M %'`;

        try {
            const response = await fetch(simbadUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `request=doQuery&lang=adql&format=json&query=${encodeURIComponent(query)}`
            });

            const data = await response.json();
            this.processDeepSkyObjects(data);
        } catch (error) {
            console.error('Error loading deep sky objects:', error);
        }
    }

    async loadPlanetaryData() {
        const horizonsUrl = 'https://ssd.jpl.nasa.gov/api/horizons.api';
        const planets = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'];
        
        this.planets = await Promise.all(planets.map(async planet => {
            try {
                const response = await fetch(horizonsUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `format=json&COMMAND='${planet}'&OBJ_DATA=YES&EPHEM_TYPE=OBSERVER&CENTER='@399'`
                });
                
                const data = await response.json();
                return this.processPlanetData(data, planet);
            } catch (error) {
                console.error(`Error loading data for ${planet}:`, error);
                return null;
            }
        }));
    }

    getStar(name) {
        return this.stars.find(star => star.name === name);
    }

    getConstellationLines(constellation) {
        return this.constellationLines.filter(line => line.constellation === constellation);
    }

    getActiveMeteoShowers() {
        return this.meteorShowers.filter(shower => shower.active);
    }

    getDSOsByType(type) {
        return this.deepSkyObjects[type] || [];
    }

    async fetchCommonName(hrId) {
        const id = hrId.replace('HR ', '');
        return this.commonNames[id] || null;
    }
}