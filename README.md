# Solmar Bay — Neon Tide

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/lively-lynx-26/gta6-01-v2/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/lively-lynx-26/gta6-01-v2/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for make.fun's **gta6-01 — Make GTA 6** bounty.
Dario Cruz is back in Solmar Bay, a sun-soaked coastal city, with empty pockets
and a fast right foot. Drive the Neon Mile, outrun the Solmar Bay Police, take
five story jobs for Rosa's Garage, and become King of Solmar.

## The game

- **A city to explore on foot and by car** — eight-by-eight blocks of streets,
  the Bayfront Plaza with its fountain, the Docks, the Marina, the beach and
  the ocean, all built from a fixed seed so the city is the same every run.
- **Traffic and pedestrians** — civilian cars cruise the road lattice and turn
  at intersections; residents stroll the sidewalks and flee from gunfire.
- **Cars to steal and drive** — any parked car is yours: sedans, the Bay Cab,
  the Comet GT sports car, vans and the armored Vault Hauler. Stealing one
  raises the heat.
- **Wanted level and police** — zero to five stars; cruisers chase, ram and
  block. Break line of sight and distance to cool off.
- **Five story missions** — Sunset Fare, Borrowed Wheels, The Drop, Dockside
  Heat, and the finale, King of Solmar. Each pays cash and unlocks the next.
- **Combat** — a pistol with a twelve-round magazine for the jobs that need it.

## Play

Serve the built game and open it in a desktop browser:

```sh
node serve.ts
```

Then open http://localhost:8080. WASD moves, mouse drag orbits the camera,
E enters or leaves a car, Space brakes, Escape pauses. The title menu offers
NEW GAME and CONTINUE; progress saves in the browser.

## Build

The entry program copies the game and its screenshots into the output
directory and writes the dossier the judge reads:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Credits

Built from scratch for the make.fun gta6-01 bounty. Three.js is vendored
under game/vendor under its MIT license. Everything else is original work.
