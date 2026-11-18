// Solmar Bay — Neon Tide: screenshot scene presets. Each of the four
// screenshots is one named scene, selectable in the browser through the
// `shot` query parameter (see shots.json): a police chase in the Comet GT
// at golden hour with the helicopter overhead, driving the Bay Cab with a
// fare waiting, on foot at Bayfront Plaza mid-firefight, and the full city
// map screen. A preset places the player, the car, the camera and the HUD
// text, then the game advances a fixed number of fixed-length steps so the
// shot is fully deterministic: the same seed always renders the same frame.

export const SHOTS = {
  chase: {
    mode: 'car',
    carType: 'comet',
    x: -48,
    z: -40,
    heading: 0, // south, down the avenue past the plaza
    speed: 38,
    cameraDistance: 9,
    cameraPitch: -0.22,
    cash: 1700,
    stars: 3,
    rep: 460,
    smg: true, // mission 2 is done, so the SMG slot shows unlocked
    mission: 'Mission 3 — The Drop',
    objective: 'Lose the cruisers and make the delivery',
    waypoint: { x: 0, z: 150 }, // the delivery point, marked on the minimap
    missionIndex: 2,
    golden: true, // golden hour: warm sky, low sun
    heli: true, // AIR-1 circles overhead with its searchlight
    trafficNear: true, // three traffic cars on the avenue ahead
    clockMinutes: 120, // 19:24, sunset
    steps: 24, // short: the cruisers close in during the steps, so fewer
    // steps keep them in the frame instead of on top of the camera
  },
  drive: {
    mode: 'car',
    carType: 'cab',
    x: -60,
    z: -48,
    heading: Math.PI / 2, // east, along the street north of the plaza
    speed: 14,
    cameraDistance: 9,
    cameraPitch: -0.24,
    cash: 120,
    stars: 0,
    rep: 0,
    mission: 'Mission 1 — Sunset Fare',
    objective: 'Pick up the fare, then drive to the Marina',
    waypoint: { x: 140, z: -24 }, // the Marina drop-off, marked on the minimap
    missionIndex: 0,
    trafficNear: true, // traffic on the street, and a fare at the curb
    clockMinutes: 30, // 17:54
    steps: 40,
  },
  foot: {
    mode: 'foot',
    x: 8,
    z: 12,
    heading: -2.6, // facing the fountain in Bayfront Plaza
    speed: 0,
    cameraDistance: 7.5,
    cameraPitch: -0.26,
    cash: 460,
    stars: 0,
    rep: 120, // mission 1 done
    mission: 'Mission 2 — Borrowed Wheels',
    objective: 'Clear the goons at the Plaza',
    waypoint: { x: 0, z: 0 }, // the Plaza, marked on the minimap
    missionIndex: 1,
    clockMinutes: 45, // 18:09
    steps: 20,
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
    waypoint: { x: 0, z: 150 }, // the Docks, marked on the minimap
    missionIndex: 3,
    clockMinutes: 90, // 18:54
    steps: 20,
  },
};

export function shotNames() {
  return Object.keys(SHOTS);
}
