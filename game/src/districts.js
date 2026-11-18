// Solmar Bay — Neon Tide: districts. The city is split into named
// districts, each with a tagline; entering one shows its name card in the
// HUD, and the full map screen lists them all. The districts are defined
// by rectangles in world coordinates, checked in order, so the first match
// wins; the fallbacks cover the outer streets.

export const DISTRICTS = [
  { name: 'BAYFRONT PLAZA', tagline: 'The heart of Solmar Bay', x0: -52, x1: 52, z0: -52, z1: 52 },
  { name: 'THE DOCKS', tagline: 'Warehouses, piers and old money', x0: -96, x1: 96, z0: 144, z1: 192 },
  { name: 'THE MARINA', tagline: 'Yachts, salt air and fast boats', x0: 144, x1: 192, z0: -72, z1: 24 },
  { name: 'CORAL SHORE', tagline: 'Paloma Boulevard, golden sand', x0: -192, x1: 192, z0: 192, z1: 230 },
  { name: 'OLD TOWN', tagline: 'Brick lanes and corner cafés', x0: -192, x1: -52, z0: -192, z1: -52 },
  { name: 'HARBOR HEIGHTS', tagline: 'Glass towers over the bay', x0: 52, x1: 192, z0: -192, z1: -52 },
  { name: 'PALOMA BOULEVARD', tagline: 'Neon signs and late nights', x0: -192, x1: -52, z0: 52, z1: 192 },
  { name: 'SUNSET ROW', tagline: 'Garages, diners and dive bars', x0: 52, x1: 192, z0: 52, z1: 144 },
];

// The district a world point belongs to, or null off the map.
export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d;
  }
  return null;
}

// Landmarks the map screen and the minimap legend name.
export const LANDMARKS = [
  { name: "Rosa's Garage", x: 48, z: 48, icon: 'G' },
  { name: 'Bayside Arms', x: -48, z: 96, icon: 'A' },
  { name: 'Safehouse', x: 144, z: 96, icon: 'H' },
  { name: 'Hospital', x: -96, z: -96, icon: '+' },
  { name: 'Police HQ', x: 96, z: -144, icon: 'P' },
  { name: 'Spray Bay', x: 96, z: 48, icon: 'S' },
];
