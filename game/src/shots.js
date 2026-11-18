// Solmar Bay — Neon Tide: screenshot scene presets. Each of the four
// screenshots is one named scene, selectable in the browser through the
// `shot` query parameter (see shots.json): a police chase in the Comet GT,
// driving the Bay Cab, on foot at Bayfront Plaza, and the Docks mission.
// A preset places the player, the car, the camera and the HUD text, then the
// game advances a fixed number of fixed-length steps so the shot is fully
// deterministic: the same seed always renders the same frame.

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
    cash: 1240,
    stars: 3,
    mission: 'Mission 3 — The Drop',
    objective: 'Lose the cruisers and make the delivery',
    steps: 40,
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
    mission: 'Mission 1 — Sunset Fare',
    objective: 'Drive the fare across town',
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
    cash: 340,
    stars: 0,
    mission: 'Mission 2 — Borrowed Wheels',
    objective: 'Take the wheels on foot',
    steps: 20,
  },
  mission: {
    mode: 'foot',
    x: -24,
    z: 152,
    heading: 0.1, // south through the gap between warehouses, piers and ocean ahead
    speed: 0,
    cameraDistance: 8,
    cameraPitch: -0.28,
    cash: 890,
    stars: 2,
    mission: 'Mission 4 — Dockside Heat',
    objective: 'Clear the docks',
    steps: 20,
  },
};

export function shotNames() {
  return Object.keys(SHOTS);
}
