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
  // the Vault Hauler heavy and tough, sedans and vans in between. Two bikes
  // join the fleet: the Nebula R sport bike (quick, twitchy, leans into
  // turns) and the Ironhog cruiser (slower, steadier).
  cars: {
    sedan: { name: 'Sedan', accel: 11, maxSpeed: 42, reverseSpeed: 10, turn: 1.9, grip: 8, color: 0x3a6ea5, body: 'sedan' },
    cab: { name: 'Bay Cab', accel: 10, maxSpeed: 38, reverseSpeed: 9, turn: 2.0, grip: 8, color: 0xf2b705, body: 'sedan' },
    comet: { name: 'Comet GT', accel: 18, maxSpeed: 55, reverseSpeed: 12, turn: 2.3, grip: 10, color: 0xc22424, body: 'sport' },
    van: { name: 'Van', accel: 8, maxSpeed: 34, reverseSpeed: 8, turn: 1.6, grip: 7, color: 0x7a7f85, body: 'van' },
    hauler: { name: 'Vault Hauler', accel: 7, maxSpeed: 30, reverseSpeed: 7, turn: 1.4, grip: 6, color: 0x2e3138, body: 'hauler' },
    sportbike: { name: 'Nebula R', accel: 20, maxSpeed: 58, reverseSpeed: 8, turn: 3.1, grip: 6, color: 0x2fd4c4, body: 'bike' },
    cruiser: { name: 'Ironhog', accel: 13, maxSpeed: 44, reverseSpeed: 7, turn: 2.2, grip: 7, color: 0x7a4a2b, body: 'bike' },
  },
  carRadius: 1.15, // collision radius used for cars against buildings
  bikeRadius: 0.7, // bikes are narrower than cars

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
    swat: { name: 'SWAT Van', accel: 11, maxSpeed: 44, reverseSpeed: 9, turn: 1.8, grip: 9, color: 0x1c2733, body: 'van' },
    swatRamDamage: 12, // a SWAT van hits harder than a cruiser
    maxCruisers: 5,
    spawnDistance: 70, // cruisers arrive this far from the player
    despawnDistance: 135, // a leaving cruiser is removed past this distance
    ramDistance: 5, // a cruiser this close to the player's car rams it
    ramDamage: 7, // car health lost per ram
    coolRange: 50, // no cruiser with line of sight inside this range: cooling
    coolTime: [6, 9, 12, 15, 18], // seconds to shed one star, per star level
  },
  // Pay'n'Spray: drive into Spray Bay with heat on and $200 clears every
  // star. The bay sits at the 96/48 intersection, on the map as 'S'.
  sprayBay: { x: 96, z: 48, radius: 8, price: 200 },

  // Combat. Six weapons in slots 1-6: fists and the bat are melee, the
  // pistol Dario starts with, the Squall SMG unlocked after mission 2,
  // the Breaker 12 shotgun unlocked after mission 4, and the Longshot
  // rifle from the gun shop.
  fists: {
    name: 'FISTS',
    damage: 25, // a punch; every third hit in a combo lands harder
    comboDamage: 40,
    range: 2.4,
    swingSeconds: 0.45,
  },
  bat: {
    name: 'BAT',
    damage: 45,
    range: 2.6,
    swingSeconds: 0.6,
    price: 250,
  },
  rifle: {
    name: 'Longshot Rifle',
    magazine: 8,
    damage: 70, // two hits drop a mission goon
    range: 95,
    reloadSeconds: 2.0,
    heatPerShot: 1 / 2,
    price: 1800,
  },
  pistol: {
    magazine: 12,
    damage: 34, // three hits drop a mission goon
    range: 60,
    reloadSeconds: 0.9,
    heatPerShot: 1 / 3, // three shots are worth one star
  },
  smg: {
    name: 'Squall SMG',
    magazine: 30,
    damage: 20, // six hits drop a mission goon
    range: 55,
    reloadSeconds: 1.4,
    fireInterval: 0.09, // hold to fire
    heatPerShot: 1 / 5,
    price: 800,
  },
  shotgun: {
    name: 'Breaker 12',
    magazine: 6,
    damage: 30, // three pellets per shot, 90 up close
    pellets: 3,
    range: 32,
    reloadSeconds: 2.2,
    heatPerShot: 1 / 2,
    price: 1200,
  },

  // The police helicopter: at four stars and up (and in mission 3) AIR-1
  // circles above the player with a searchlight.
  helicopter: {
    minStars: 4,
    height: 34,
    circleRadius: 30,
    orbitSpeed: 0.35, // radians per second around the player
  },

  // REP / respect: earned on jobs and stunts, spent nowhere — it is a
  // rank. Tiers are ROOKIE, HUSTLER, WHEELMAN, FIXER, KING OF SOLMAR.
  repTiers: [
    { name: 'ROOKIE', at: 0 },
    { name: 'HUSTLER', at: 500 },
    { name: 'WHEELMAN', at: 1500 },
    { name: 'FIXER', at: 3000 },
    { name: 'KING OF SOLMAR', at: 6000 },
  ],
  repForMission: [120, 340, 500, 450, 550, 800, 1000], // per mission index
  repNearMiss: 25,
  repDrift: 15,
  repJump: 25, // a stunt jump, or stopping a mugging
  repTakedown: 100,
  repEscape: 150, // losing every star while wanted
  repFare: 20,
  repRace: 200,
  repShell: 10,

  // Rosa's Garage: upgrades for the car Dario drives, a respray that
  // clears the heat, and the gun shop. Prices in dollars.
  garage: {
    position: { x: 48, z: 48 }, // Rosa's Garage, on the plaza's east side
    enginePrice: 500, // +15% top speed and acceleration, up to 3 levels
    armorPrice: 600, // +50 max car health, up to 3 levels
    nitroPrice: 400, // Shift for a boost while driving
    resprayPrice: 150, // new paint + clears the wanted level
    safehousePrice: 1500, // buy once: heal on visit, save anywhere
    paintColors: [0xc22424, 0x2e6f8e, 0xf2b705, 0x2e8b57, 0x6a3d9a, 0xe8e8e8],
  },

  // Radio: three stations, each with a song and its artist, and a short jingle.
  radio: [
    { name: 'SOLMAR FM 96.4', song: 'Sunset Drive', artist: 'The Solmarines', notes: [523, 659, 784, 1047] },
    { name: 'NEON WAVE 88.1', song: 'Midnight Tide', artist: 'Glass Harbor', notes: [440, 554, 659, 880] },
    { name: 'BAY BEATS 104.7', song: 'Paloma Nights', artist: 'Neon Palms', notes: [392, 494, 587, 784] },
  ],

  // Boats: the speedboat moored in the Marina basin and the jet ski at the
  // beach by the Docks. Boats float on the bay and leave a wake behind.
  boats: {
    speedboat: { name: 'Wave Runner 290', accel: 13, maxSpeed: 46, reverseSpeed: 8, turn: 2.4, color: 0xf2f2f2 },
    jetski: { name: 'Sea Skimmer', accel: 16, maxSpeed: 50, reverseSpeed: 6, turn: 3.3, color: 0xffd23e },
  },
  // The flyable civilian helicopter ("Maverick") parked on the helipad at
  // the east end of the beach, by the Marina. W/S flies forward and back,
  // A/D turns, Shift climbs, Space descends.
  heli: {
    name: 'Maverick', accel: 16, climbSpeed: 14, maxSpeed: 48, turn: 2.0, ceiling: 90,
    color: 0xffc93e, stripe: 0x2b2f38,
  },
  helipad: { x: 150, z: 204, radius: 9 },
  // The clock: the game starts Friday 17:24 and the clock runs about one
  // game-hour per two real minutes (0.5 game-minutes per real second), so
  // night falls roughly five real minutes after the start.
  clock: { day: 'FRI', startMinutes: 17 * 60 + 24, rate: 0.5 },
  golden: {
    top: 0x2a4d8f,
    horizon: 0xff9a52,
    sun: 0xffb45e,
    sunIntensity: 2.2,
    hemiSky: 0x8f9fd0,
    hemiGround: 0x7a5a3f,
    hemiIntensity: 0.9,
    fog: 0xe8b98a,
  },
  // Weather: clear, cloudy, rain and storm rotate on a seeded schedule.
  // Rain darkens and slickens the roads (lower grip) and storms flash
  // lightning. Durations are seconds of real time.
  weather: {
    clearGrip: 1.0,
    cloudyGrip: 0.9,
    rainGrip: 0.72,
    stormGrip: 0.68,
    durations: { clear: [180, 360], cloudy: [120, 240], rain: [90, 180], storm: [60, 120] },
  },

  // Properties: a penthouse upgrade in Harbor Heights that refills
  // health and armour on visit, and a stake in the Bay Cab Co. that pays
  // passive income every 45 real seconds.
  properties: {
    penthouse: { x: 144, z: -96, radius: 8, price: 4000, armorRefill: 50 },
    taxico: { x: -144, z: 96, radius: 8, price: 2500, payEvery: 45, payAmount: 120 },
  },

  // Stunt jumps: three ramps around the city. Cross one fast in a car or
  // on a bike and the jump is scored on airtime and distance. `name` is
  // where the jump happened, for the map stats.
  jumps: [
    { x: -96, z: 0, heading: Math.PI / 2, minSpeed: 16, name: 'Plaza Flyover' }, // east, over the plaza approach
    { x: 48, z: 144, heading: 0, minSpeed: 16, name: 'Pier 9' }, // south, toward the Docks
    { x: -144, z: -48, heading: Math.PI, minSpeed: 16, name: 'Old Town Rise' }, // north, up Old Town
  ],
  jumpPayPerMetre: 6, // dollars per metre jumped, capped
  jumpPayCap: 400,
  // Random events on the street: a mugging to interrupt and a hitchhiker
  // to drive. They spawn after the first job, one at a time.
  events: {
    firstAfter: 30, // seconds into free roam before the first event
    gap: [60, 120], // seconds between events
    muggingReward: 40,
    hitchReward: 60,
  },
  farePay: 120,
  racePay: 300,
  raceStart: { x: 144, z: -24 }, // Boulevard Sprint starts at the Marina
  raceTarget: { x: -144, z: 144 }, // and ends at the Docks corner
  raceTimeLimit: 75, // seconds
  shells: 12,
  shellPay: 50,
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
