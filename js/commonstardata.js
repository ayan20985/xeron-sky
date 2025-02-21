// Common star names mapped to their HR (Harvard Revised) catalog numbers
export const commonStarNames = {
    // First magnitude stars (brightest)
    '2491': 'Sirius',          // Alpha Canis Majoris
    '5340': 'Arcturus',        // Alpha Boötis
    '7001': 'Vega',           // Alpha Lyrae
    '1708': 'Betelgeuse',     // Alpha Orionis
    '2326': 'Rigel',          // Beta Orionis
    '472': 'Achernar',        // Alpha Eridani
    '2943': 'Procyon',        // Alpha Canis Minoris
    '5267': 'Spica',          // Alpha Virginis
    '1457': 'Aldebaran',      // Alpha Tauri
    '1903': 'Capella',        // Alpha Aurigae
    '6134': 'Antares',        // Alpha Scorpii
    '7557': 'Altair',         // Alpha Aquilae
    
    // North Star and important navigational stars
    '424': 'Polaris',         // Alpha Ursae Minoris
    '5563': 'Kochab',         // Beta Ursae Minoris
    '5235': 'Pherkad',        // Gamma Ursae Minoris
    
    // Big Dipper stars (Ursa Major)
    '4301': 'Phecda',         // Gamma Ursae Majoris
    '4295': 'Megrez',         // Delta Ursae Majoris
    '4554': 'Merak',          // Beta Ursae Majoris
    '4905': 'Alioth',         // Epsilon Ursae Majoris
    '5191': 'Mizar',          // Zeta Ursae Majoris
    '4534': 'Alcor',          // 80 Ursae Majoris
    '4660': 'Alcaid',         // Eta Ursae Majoris
    '4853': 'Dubhe',          // Alpha Ursae Majoris
    
    // Little Dipper stars (Ursa Minor)
    '6789': 'Yildun',         // Delta Ursae Minoris
    '6322': 'Alifa',          // Epsilon Ursae Minoris
    
    // Orion constellation
    '1790': 'Bellatrix',      // Gamma Orionis
    '1903': 'Mintaka',        // Delta Orionis
    '1948': 'Alnilam',        // Epsilon Orionis
    '1852': 'Alnitak',        // Zeta Orionis
    '1899': 'Saiph',          // Kappa Orionis
    
    // Scorpius constellation
    '6165': 'Graffias',       // Beta Scorpii
    '6134': 'Antares',        // Alpha Scorpii
    '6527': 'Shaula',         // Lambda Scorpii
    '6553': 'Lesath',         // Upsilon Scorpii
    
    // Gemini constellation
    '2890': 'Alhena',         // Gamma Geminorum
    '2421': 'Tejat',          // Mu Geminorum
    '2216': 'Propus',         // Eta Geminorum
    '2990': 'Pollux',         // Beta Geminorum
    '2061': 'Castor',         // Alpha Geminorum
    
    // Canis Major constellation
    '2294': 'Mirzam',         // Beta Canis Majoris
    '2387': 'Wezen',          // Delta Canis Majoris
    '2618': 'Aludra',         // Eta Canis Majoris
    
    // Taurus constellation
    '1791': 'Elnath',         // Beta Tauri
    '1910': 'Alcyone',        // Eta Tauri (Pleiades)
    
    // Carina constellation
    '2326': 'Canopus',        // Alpha Carinae
    '3685': 'Miaplacidus',    // Beta Carinae
    
    // Centaurus constellation
    '5267': 'Rigil Kentaurus', // Alpha Centauri
    '5460': 'Hadar',          // Beta Centauri
    
    // Cygnus constellation
    '7924': 'Deneb',          // Alpha Cygni
    '7417': 'Sadr',           // Gamma Cygni
    '7796': 'Albireo',        // Beta Cygni
    
    // Leo constellation
    '3982': 'Regulus',        // Alpha Leonis
    '4534': 'Denebola',       // Beta Leonis
    '4357': 'Algieba',        // Gamma Leonis
    '4031': 'Zosma',          // Delta Leonis
    
    // Cassiopeia constellation
    '168': 'Shedar',          // Alpha Cassiopeiae
    '542': 'Caph',            // Beta Cassiopeiae
    '403': 'Ruchbah',         // Delta Cassiopeiae
    
    // Perseus constellation
    '1017': 'Mirfak',         // Alpha Persei
    '936': 'Algol',           // Beta Persei
    
    // Andromeda constellation
    '464': 'Alpheratz',       // Alpha Andromedae
    '603': 'Mirach',          // Beta Andromedae
    '337': 'Almach',          // Gamma Andromedae
    
    // Pegasus constellation
    '8775': 'Markab',         // Alpha Pegasi
    '8781': 'Scheat',         // Beta Pegasi
    '8308': 'Algenib',        // Gamma Pegasi
    '8650': 'Enif',           // Epsilon Pegasi
    
    // Sagittarius constellation
    '7194': 'Kaus Australis', // Epsilon Sagittarii
    '7121': 'Nunki',          // Sigma Sagittarii
    
    // Additional bright stars
    '5056': 'Regulus',        // Alpha Leonis
    '3982': 'Alphard',        // Alpha Hydrae
    '5054': 'Denebola',       // Beta Leonis
    '3685': 'Algieba',        // Gamma Leonis
    '4550': 'Mizar A',        // Zeta Ursae Majoris A
    '4552': 'Mizar B',        // Zeta Ursae Majoris B
    '617': 'Ankaa',           // Alpha Phoenicis
    '1457': 'Aldebaran',      // Alpha Tauri
    '2061': 'Castor',         // Alpha Geminorum
    '5793': 'Rasalhague',     // Alpha Ophiuchi
    '6556': 'Rasalgethi',     // Alpha Herculis
    '7796': 'Albireo',        // Beta Cygni
    '8162': 'Sadalmelik',     // Alpha Aquarii
    '8232': 'Fomalhaut',      // Alpha Piscis Austrini
    '8414': 'Deneb Algedi',   // Delta Capricorni
    '8728': 'Sadalsuud',      // Beta Aquarii
    '8773': 'Enif',           // Epsilon Pegasi
    '8781': 'Scheat',         // Beta Pegasi
    '8834': 'Markab',         // Alpha Pegasi
    '1017': 'Mirfak',         // Alpha Persei
    '1228': 'Menkar',         // Alpha Ceti
    '2990': 'Pollux',         // Beta Geminorum
    '3748': 'Alphard',        // Alpha Hydrae
    '4534': 'Alcor',          // 80 Ursae Majoris
    '5056': 'Regulus',        // Alpha Leonis
    '5459': 'Alkaid',         // Eta Ursae Majoris
    '6527': 'Shaula',         // Lambda Scorpii
    '6705': 'Ras Algethi',    // Alpha Herculis
    '7001': 'Vega'            // Alpha Lyrae
}; 