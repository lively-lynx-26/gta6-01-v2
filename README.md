# Solmar Bay — Neon Tide

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/lively-lynx-26/gta6-01-v2/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/lively-lynx-26/gta6-01-v2/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for make.fun's **gta6-01 — Make GTA 6** bounty.
Dario Cruz is back in Solmar Bay with empty pockets and a fast right foot. The
sun is out over the bay, the traffic is moving, and Rosa's Garage has five
jobs with his name on them. Steal a car, outrun the Solmar Bay Police, get
paid — and by the last job, take the city and become King of Solmar.

## The city

Solmar Bay is a sun-soaked coastal city, eight blocks by eight blocks of
streets built from a fixed seed, so it is the same city on every run:

- **Bayfront Plaza** — the fountain at the city's heart, where the second
  job's goons guard a Comet GT.
- **The Docks** — warehouses and piers on the south edge, where a delivery
  and a fight are waiting.
- **The Marina** — boats and open water on the east edge, where the first
  fare ends.
- **The beach and the ocean** — sand and water past the south edge, under a
  bright sky with drifting clouds and a flock of birds.

Civilian cars cruise the road lattice and turn at intersections; cabs work
the Marina and delivery vans work the Docks. Residents stroll the sidewalks
and run from gunfire. The Solmar Bay Police cruise in white-and-black
cruisers with flashing light bars and two-tone sirens.

## The jobs — five for Rosa's Garage

One job is active at a time. Each shows its title and objective in the HUD,
marks its target with a gold waypoint beacon, pays cash on completion, and
unlocks the next. Fail a job — Dario goes down, or the job's car is wrecked —
and it restarts from where it began; the cash already earned stays earned.

1. **Sunset Fare** — drive the Bay Cab to the Marina. Pays $120.
2. **Borrowed Wheels** — clear the goons at the Plaza on foot, then take
   the Comet GT. Pays $340.
3. **The Drop** — deliver to the Docks in the Comet GT with three cruisers
   on your tail at three stars. Pays $1,240.
4. **Dockside Heat** — clear the Docks at two stars. Pays $890.
5. **King of Solmar** — take the Vault Hauler to the Plaza and clear the
   guards. Pays $2,500.

## How to play

Serve the game and open it in a desktop browser:

```sh
node serve.ts
```

Then open http://localhost:8080. The title menu offers NEW GAME and
CONTINUE; progress saves in the browser.

| Key | Does |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| E | Enter or leave a car |
| F or click | Fire the pistol (12-round magazine) |
| R | Reload |
| Space | Brake / handbrake — slide and you will hear the tyres |
| Drag mouse | Orbit the camera |
| M | Mute |
| Esc | Pause (Save & Quit from the pause menu) |

The HUD shows the mission and its objective, the cash, the wanted stars,
health and car bars, speed, the current vehicle and the ammunition. The
live minimap in the bottom-left corner shows the streets, the gold mission
waypoint, traffic in white, cruisers flashing red and blue, and Dario as a
yellow arrow.

**Tips:** stealing a car raises the heat by a star, and so does every third
pistol shot — the cruisers come faster the higher it climbs. Break line of
sight and distance to cool off, one star at a time. A car that is badly
hurt smokes from the engine and its paint goes sooty; a wrecked car stalls,
so change cars before it gives out.

## Build

The entry program copies the game and its screenshots into the output
directory and writes the dossier the judge reads:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

It runs twice with byte-identical output, and it never deletes the output
directory itself. The game is plain static files under `game/` — three.js
vendored under `game/vendor`, every sound synthesised with WebAudio, no
network request at all.

## Credits

Built from scratch for the make.fun gta6-01 bounty. Three.js is vendored
under game/vendor under its MIT license. Everything else — the city, the
cars, the story, the code — is original work.
