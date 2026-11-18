// Solmar Bay — Neon Tide: every configuration number in one place.
// The city is built from a fixed seed, so it is the same on every run.

export const CFG = {
  // World layout (metres). Eight blocks by eight blocks, streets between them.
  seed: 1337,
  blocks: 8,
  blockPitch: 48, // centre-to-centre distance between neighbouring blocks
  streetWidth: 12,
  blockSize: 36, // 48 - 12: the buildable square inside each block
  halfSpan: 192, // 8 * 48 / 2: the city runs from -192 to +192 on both axes

  // Districts (centres in world coordinates).
  plaza: { x: 0, z: 0, radius: 52 }, // Bayfront Plaza, two blocks wide
  docks: { x: 0, z: 168 }, // the Docks, south edge
  marina: { x: 168, z: -24 }, // the Marina, east edge
  beach: { z0: 192, z1: 216 }, // sand strip south of the city
  ocean: { z0: 216 }, // open water south of the beach

  // The player on foot.
  walkSpeed: 6.5, // metres per second
  playerRadius: 0.55,
  playerHeight: 1.8,

  // Cars. Each type feels different: the Comet GT is fast, the Bay Cab steady,
  // the Vault Hauler heavy and tough, sedans and vans in between.
  cars: {
    sedan: { name: 'Sedan', accel: 11, maxSpeed: 42, reverseSpeed: 10, turn: 1.9, grip: 8, color: 0x3a6ea5, body: 'sedan' },
    cab: { name: 'Bay Cab', accel: 10, maxSpeed: 38, reverseSpeed: 9, turn: 2.0, grip: 8, color: 0xf2b705, body: 'sedan' },
    comet: { name: 'Comet GT', accel: 18, maxSpeed: 55, reverseSpeed: 12, turn: 2.3, grip: 10, color: 0xc22424, body: 'sport' },
    van: { name: 'Van', accel: 8, maxSpeed: 34, reverseSpeed: 8, turn: 1.6, grip: 7, color: 0x7a7f85, body: 'van' },
    hauler: { name: 'Vault Hauler', accel: 7, maxSpeed: 30, reverseSpeed: 7, turn: 1.4, grip: 6, color: 0x2e3138, body: 'hauler' },
  },
  carRadius: 1.15, // collision radius used for cars against buildings

  // Population at the start of a run (traffic and pedestrians arrive in a
  // later chunk; the parked fleet is placed by the city builder now).
  parkedCars: 10,

  // World life (chunk 2): traffic, pedestrians, police and the wanted system.
  trafficCars: 12, // civilian cars cruising the road lattice
  pedestrians: 26, // residents strolling the sidewalks
  pedWalkSpeed: [1.1, 1.6], // metres per second, strolling
  pedStride: [0.45, 0.65], // leg swing amplitude, radians
  pedGait: [0.9, 1.15], // walk-cycle speed factor
  pedHeight: [0.93, 1.07], // figure height factor
  pedFleeSpeed: 4.6, // metres per second, running from gunfire
  pedFleeRadius: 35, // gunfire within this many metres makes peds flee

  // The wanted system: stars 0-5. Stealing a car is worth one star; three
  // pistol shots are worth one star; running a pedestrian over is one star.
  // Cruisers chase; break line of sight and distance to cool off, one star
  // at a time.
  police: {
    cruiser: { name: 'Police Cruiser', accel: 14, maxSpeed: 48, reverseSpeed: 10, turn: 2.1, grip: 9, color: 0xf2f2f2, body: 'police' },
    maxCruisers: 5,
    spawnDistance: 70, // cruisers arrive this far from the player
    despawnDistance: 135, // a leaving cruiser is removed past this distance
    ramDistance: 5, // a cruiser this close to the player's car rams it
    ramDamage: 7, // car health lost per ram
    coolRange: 50, // no cruiser with line of sight inside this range: cooling
    coolTime: [6, 9, 12, 15, 18], // seconds to shed one star, per star level
  },

  // Combat.
  pistol: {
    magazine: 12,
    damage: 34, // three hits drop a mission goon
    range: 60,
    reloadSeconds: 0.9,
    heatPerShot: 1 / 3, // three shots are worth one star
  },
  enemy: {
    health: 100,
    engageRange: 45,
    shootRange: 42,
    damageOnFoot: 9,
    damageInCar: 4,
    shootInterval: 1.4,
  },

  // Camera (third person).
  camera: {
    footDistance: 7.5,
    footHeight: 3.2,
    carDistance: 10.5,
    carHeight: 4.2,
    lerp: 6.5, // smoothing rate per second
  },

  // Frame time is clamped so the game advances no more than this many seconds
  // of game time per rendered frame.
  maxDt: 0.05,

  // Money.
  startCash: 0,

  // Persistence.
  saveKey: 'solmarbay.save.v1',

  // Look: daytime, bright sun, blue sky, golden light on the water.
  sky: {
    top: 0x2f7fe0,
    horizon: 0xbfe3f5,
    sun: 0xfff2cf,
    sunIntensity: 2.6,
    hemiSky: 0xbfd9ff,
    hemiGround: 0x8a7a5f,
    hemiIntensity: 1.05,
    fog: 0xcfe6f2,
    fogNear: 260,
    fogFar: 620,
  },

  // Building palette: warm coastal colours, nothing garish.
  buildingColors: [0xe8dcc8, 0xd9c4a5, 0xc9b18c, 0xe5e0d5, 0xf0e6d2, 0xd8cdb8, 0xcbb59a, 0xe2d4c0],
  roofColors: [0x8a6f55, 0x6f7d8c, 0x9a8a76, 0x7a6a58],
};
