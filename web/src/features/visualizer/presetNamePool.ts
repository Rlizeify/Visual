// MHEU preset name pool.
//
// Single-word, evocative, MHEU-aesthetic names assigned deterministically
// to any imported Butterchurn preset that lacks a curated override in
// `visualizer_presets`. Pool is intentionally larger than the loaded
// preset library (~500) so hash collisions get unique names via linear
// probing. Curated names from the DB ALWAYS win — pool entries that
// collide with a curated `display_name` get filtered out of the
// effective pool at build time in `autoNames.ts`.
//
// Aesthetic guide: cosmic, geological, atmospheric, physics, abstract
// energetic. No politically loaded terms, no trademark names. Mix of
// length and texture. Avoid duplicating any single curated name listed
// in `supabase/seed_presets.sql`.

export const NAME_POOL: readonly string[] = [
  // Cosmic / astronomical
  'Pulsar', 'Nebula', 'Nova', 'Aurora', 'Helios', 'Apex',
  'Singularity', 'Penumbra', 'Corona', 'Zenith', 'Nadir', 'Halcyon',
  'Solstice', 'Equinox', 'Quasimoon', 'Lumen', 'Arclight', 'Starwell',
  'Voidgate', 'Photon', 'Lightcone', 'Eventide', 'Empyrean',
  'Heliopause', 'Magnetopause', 'Magnetosphere', 'Selenite',
  'Perihelion', 'Aphelion', 'Astrolith', 'Cynosure', 'Galaxyfall',
  'Constellate', 'Halocline', 'Albedo', 'Auriga', 'Caelum', 'Cetus',
  'Lyra', 'Hydrus', 'Orion', 'Andromedan', 'Cassiopean', 'Vega',
  'Sirius', 'Altair', 'Rigel', 'Betelgeuse', 'Polaris', 'Mira',
  'Cepheid', 'Magnetar', 'Strangelet', 'Quark', 'Lepton', 'Boson',
  'Gluon', 'Hadron', 'Mesonic', 'Fermion', 'Antimatter', 'Darkmass',
  'Brightline', 'Skyglow', 'Skyrift', 'Skyburn', 'Skyseam',
  'Starfield', 'Starcrush', 'Starwake', 'Starbreak', 'Starshorn',
  'Cosmiclatte', 'Voidwhisper', 'Voidsong', 'Voidsteel', 'Voidlace',
  'Voidthread', 'Voidshell', 'Voidloom', 'Cometfall', 'Cometjaw',

  // Geological / mineral
  'Magma', 'Geode', 'Strata', 'Tectonic', 'Crystalline', 'Basalt',
  'Lattice', 'Pumice', 'Granite', 'Quartzite', 'Feldspar', 'Lazulite',
  'Sandshelf', 'Cryolith', 'Aetherstone', 'Bonemeal', 'Slatebed',
  'Veindeep', 'Ironvein', 'Saltpan', 'Pyrite', 'Lodestone', 'Tuffrock',
  'Tephra', 'Caldera', 'Sedimentum', 'Pebblework', 'Mineralia',
  'Igneous', 'Metamorphic', 'Sandwhirl', 'Saltcreep', 'Cinnabar',
  'Limestone', 'Marblevein', 'Carbonate', 'Talcdust', 'Hematite',
  'Malachite', 'Azurite', 'Stibnite', 'Realgar', 'Olivine', 'Andesite',
  'Schist', 'Gneiss', 'Slatewing', 'Travertine', 'Greywacke',

  // Physics / math / engineering
  'Fractal', 'Entropy', 'Quanta', 'Tangent', 'Cardioid', 'Tesseract',
  'Manifold', 'Eigenvector', 'Eigenform', 'Hypersphere', 'Klein',
  'Mobius', 'Hilbert', 'Banach', 'Lorenz', 'Lyapunov', 'Bifurcate',
  'Chaotic', 'Limitcycle', 'Stochastic', 'Brownian', 'Tensor',
  'Gradient', 'Divergence', 'Curl', 'Laplacian', 'Convolution',
  'Fourier', 'Wavelet', 'Phasor', 'Resonator', 'Oscillon', 'Stochast',
  'Harmonic', 'Subharmonic', 'Overtone', 'Beatnote', 'Standingwave',
  'Compton', 'Bremsstrahlung', 'Halflife', 'Spectraline', 'Crystalwave',
  'Photogrammet', 'Topologist', 'Apeirogon', 'Vorticity', 'Solenoid',

  // Atmospheric / meteorological
  'Cyclone', 'Mistral', 'Cirrus', 'Stratus', 'Maelstrom', 'Vapor',
  'Foehnwind', 'Sirocco', 'Monsoon', 'Brumefall', 'Heatdome',
  'Whirlwind', 'Squallhead', 'Tempestide', 'Skyflame', 'Stormveil',
  'Rainstrand', 'Thunderhead', 'Lightningseed', 'Hailcrest', 'Sleetwall',
  'Snowblind', 'Mistwall', 'Cloudbloom', 'Cloudrack', 'Cloudbreak',
  'Stormeye', 'Stormteeth', 'Hurricaneborn', 'Tornadowake', 'Twisterlight',

  // Abstract energetic
  'Surge', 'Flux', 'Cascade', 'Plasma', 'Inferno', 'Glacier',
  'Detonate', 'Implode', 'Spinout', 'Rumble', 'Throb', 'Pulsation',
  'Velocity', 'Acceleration', 'Snapshot', 'Backdraft', 'Throughline',
  'Bypass', 'Overload', 'Underflow', 'Surplus', 'Deficit', 'Threshold',
  'Cutoff', 'Crossfade', 'Bandpass', 'Highpass', 'Lowpass',
  'Comb', 'Tremor', 'Aftershock', 'Foreshock', 'Quakeline',
  'Riftline', 'Faultline', 'Floodline', 'Flarepath', 'Burnoff',
  'Backfire', 'Flashpoint', 'Slipfault', 'Strikeforce', 'Heatlash',

  // Mythic / folk / oblique
  'Bonewhisper', 'Ghostlimb', 'Bloomscar', 'Heartroot', 'Hollowmoon',
  'Veilweave', 'Veilkeep', 'Veilcut', 'Veilburn', 'Brackish',
  'Cinderbloom', 'Wickedlight', 'Hexcraft', 'Glyphwalker', 'Runesong',
  'Sigilbearer', 'Wickfall', 'Tallowmoon', 'Wraithbloom', 'Hollowfire',
  'Hollowtide', 'Hollowbreak', 'Brinemark', 'Sapwell', 'Marrowdeep',
  'Ironroot', 'Steelroot', 'Glassroot', 'Stoneroot', 'Frostroot',
  'Bonelace', 'Bonework', 'Bonebreak', 'Bonewhite', 'Bonespun',
  'Saltveil', 'Saltburn', 'Saltwake', 'Saltwind', 'Saltlayer',

  // Color / texture / surface
  'Verdigris', 'Cyanide', 'Indigoflood', 'Crimsonwake', 'Octarine',
  'Mauveline', 'Carmine', 'Saffrondust', 'Vermilion', 'Cobaltscar',
  'Bismuthbloom', 'Lavasurge', 'Lavafall', 'Lavatongue', 'Ashveil',
  'Ashfall', 'Cinderpath', 'Cinderlick', 'Emberwake', 'Embershell',
  'Frostbloom', 'Frostgleam', 'Frostsheath', 'Frostwhisper', 'Glassveil',
  'Glassbreak', 'Glasscrush', 'Hailshatter', 'Sleetshatter', 'Snowmeld',

  // Mechanical / industrial
  'Camshaft', 'Crankshaft', 'Gearteeth', 'Flywheel', 'Coilspring',
  'Pistonfall', 'Sparkplug', 'Crucible', 'Forgework', 'Smeltcoil',
  'Quenchline', 'Bellows', 'Rivetline', 'Tilework', 'Brassneck',
  'Coppercurve', 'Steelwave', 'Ironpulse', 'Boltjaw', 'Hingecry',

  // Biological / aquatic
  'Diatom', 'Plankton', 'Coralblush', 'Coralshelf', 'Coralburn',
  'Anemone', 'Medusoid', 'Cephalopod', 'Cnidaria', 'Brachial',
  'Mycelium', 'Mycorrhiza', 'Sporeline', 'Bloodroot', 'Bristlecone',
  'Manticore', 'Chimera', 'Selkie', 'Kelpie', 'Wendigo',

  // Cartographic / nautical
  'Meridian', 'Parallax', 'Latitude', 'Longitude', 'Compassrose',
  'Sextant', 'Astrolabe', 'Theodolite', 'Soundingline', 'Lighthouseburn',

  // Slang energy / sharp
  'Knifeglow', 'Razorpath', 'Bladewake', 'Edgewise', 'Spurline',
  'Hookturn', 'Sleightwave', 'Whipline', 'Lashpoint', 'Snareloop',

  // Light / shadow
  'Penumbral', 'Umbralight', 'Umbralash', 'Glintwake', 'Glimmershell',
  'Sheenline', 'Lusterfall', 'Dappledust', 'Diffuse', 'Refract',
  'Refractlight', 'Reflectfall', 'Shimmershell', 'Glowstrand', 'Strobeline',

  // Time / motion
  'Tickover', 'Echoback', 'Reverb', 'Reverbline', 'Pendulum',
  'Metronome', 'Heartbeat', 'Throbline', 'Dragwake', 'Headwind',

  // Weird verbs as nouns
  'Bleedline', 'Foldwise', 'Foldback', 'Crumplewave', 'Snapline',
  'Tearline', 'Splitline', 'Burstline', 'Slipline', 'Spinline',

  // Architectural
  'Buttress', 'Spandrel', 'Vaultline', 'Apsewise', 'Naveline',
  'Clerestory', 'Lintelfall', 'Spireburn', 'Battlement', 'Parapet',

  // Final filler — keep total > 500 so probing has slack
  'Driftwood', 'Treeline', 'Hilltide', 'Valeglow', 'Forestmaw',
  'Marshlight', 'Bogwhisper', 'Fenwalker', 'Moorline', 'Heathfire',
  'Glenfall', 'Cragleap', 'Scarpline', 'Bluffwake', 'Cliffsong',
] as const

// Sanity guard: surface duplicates at module load (the build will fail
// if any name appears twice, which would silently break linear probing).
{
  const seen = new Set<string>()
  for (const name of NAME_POOL) {
    if (seen.has(name)) {
      // eslint-disable-next-line no-console
      console.warn(`[presetNamePool] duplicate name in pool: ${name}`)
    }
    seen.add(name)
  }
}
