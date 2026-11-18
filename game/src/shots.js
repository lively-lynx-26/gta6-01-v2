// Solmar Bay — Neon Tide: screenshot scene presets. Each of the four
// screenshots is one named scene, selectable in the browser through the
// `shot` query parameter (see shots.json): the title screen with its
// story pitch and character cards, a police chase on Mission 5 at
// golden hour with the helicopter overhead, a night shootout on foot
// at Bayfront Plaza, and the full city map screen. A preset places the
// player, the car, the camera and the HUD text, then the game advances
// a fixed number of fixed-length steps so the shot is fully
// deterministic: the same seed always renders the same frame.

export const SHOTS = {
  title: {
    mode: 'title',
    golden: true, // sunset behind the title screen
    steps: 0,
  },
  chase: {
    mode: 'car',
    carType: 'comet',
    x: -48,
    z: -40,
    heading: 0, // south, down the avenue past the plaza
    speed: 54, // 121 MPH at the frame: the chase reads fast
    cameraDistance: 9,
    cameraPitch: -0.22,
    cash: 2590,
    stars: 4,
    rep: 1410, // HUSTLER, 94% to WHEELMAN
    armor: 50,
    smg: true, // mission 2 is done, so the SMG slot shows unlocked
    shotgun: true, // mission 4 is done, so the shotgun shows unlocked
    nitro: true, // garage nitro fitted: the gauge shows
    nitroCharge: 64,
    carHealth: 82, // CONDITION 82% on the HUD
    weapon: 'smg',
    mission: 'Mission 5 — Double Cross',
    objective: 'Lose the cruisers — Vince sold you out',
    stage: 'STAGE 2/3',
    timer: '2:06',
    next: 'Mission 6 — Payback',
    waypoint: { x: 0, z: 150 }, // the Docks, marked on the minimap
    missionIndex: 4,
    golden: true, // golden hour: warm sky, low sun
    heli: true, // AIR-1 circles overhead with its searchlight
    heliRadius: 22, // pulled in from the live 30 m orbit: the mesh reads large
    heliHeight: 9,
    trafficNear: true, // three traffic cars on the avenue ahead
    cruisers: 5, // a five-cruiser wedge boxing the Comet GT in
    clockMinutes: 120, // 19:24, sunset
    steps: 24, // short: the cruisers close in during the steps, so fewer
    // steps keep them in the frame instead of on top of the camera
    shells: 3, // Golden shells 3/12 in the HUD
    chatter: 'SBPD: All units, box in the red Comet GT on Bayfront Plaza!',
    dialogue: {
      name: 'Vince Marlowe',
      text: 'Sorry, Dario. SBPD made me a better offer. Nothing personal.',
      portrait: 'vince',
    },
    districtCard: true, // BAYFRONT PLAZA — The heart of Solmar Bay
  },
  foot: {
    mode: 'foot',
    x: 8,
    z: 12,
    heading: -2.6, // facing the fountain in Bayfront Plaza
    speed: 0,
    cameraDistance: 7.5,
    cameraPitch: -0.26,
    cash: 3690,
    stars: 2,
    rep: 1960, // WHEELMAN
    armor: 100,
    weapon: 'rifle', // the Longshot Rifle, slot 6
    rifle: true,
    smg: true,
    shotgun: true,
    mission: 'Mission 6 — Payback',
    objective: "Clear the Marina — Vince's crew",
    stage: 'STAGE 3/3',
    timer: '1:12',
    next: 'Mission 7 — King of Solmar',
    waypoint: { x: 140, z: -24 }, // the Marina, marked on the minimap
    missionIndex: 5,
    night: true, // dusk-night sky, lamps on, stars out
    clockMinutes: 156, // 20:00, dusk turning to night
    steps: 20,
    shells: 3,
    hidden: true, // HIDDEN: the heat is cooling off
    goons: 6, // six of Vince's crew around the fountain
    dialogue: {
      name: "Rosa — Rosa's Garage",
      text: "Six of Vince's crew at the fountain. Clear them out, Dario.",
      portrait: 'rosa',
    },
  },
  map: {
    mode: 'foot',
    x: 8,
    z: 12,
    heading: -2.6, // the plaza behind the map screen
    speed: 0,
    cameraDistance: 7.5,
    cameraPitch: -0.26,
    cash: 1700,
    stars: 2,
    rep: 1240, // three jobs done: HUSTLER
    smg: true,
    mission: 'Mission 4 — Dockside Heat',
    objective: 'Clear the docks',
    stage: 'STAGE 1/1',
    timer: '0:48',
    next: 'Mission 5 — Double Cross',
    waypoint: { x: 0, z: 150 }, // the Docks, marked on the minimap
    missionIndex: 3,
    clockMinutes: 90, // 18:54
    steps: 20,
    timePlayed: 3 * 3600 + 47 * 60, // 3h 47m on the map stats
  },
};

export function shotNames() {
  return Object.keys(SHOTS);
}
