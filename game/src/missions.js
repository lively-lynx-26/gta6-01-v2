// Solmar Bay — Neon Tide: the seven story jobs for Rosa's Garage.
//
// One job is active at a time, in order. Each shows its title and objective
// in the HUD, marks its target with a glowing waypoint beacon in the world,
// pays cash and REP on completion and unlocks the next job. The count of
// finished jobs lives on the player, so saving keeps it and reloading offers
// CONTINUE from the next job. Failing a job (Dario goes down, or the job's
// car is wrecked) restarts that job from where it began: the player is put
// back on their feet, the job's car and goons are set up fresh, and the cash
// already earned stays earned.
//
// The story turns in the middle: Vince Marlowe, the fixer who set Dario
// up with Rosa, betrays them at the Docks in job five — and job six is
// the payback, before the finale makes Dario King of Solmar.

import * as THREE from 'three';
import { CFG } from './config.js';
import { buildCarMesh } from './models.js';
import { STREETS } from './traffic.js';

// The seven jobs, in order, with their pay. The finale pays the most: it is
// the job that makes Dario King of Solmar.
export const MISSIONS = [
  { title: 'Mission 1 — Sunset Fare', pay: 120 },
  { title: 'Mission 2 — Borrowed Wheels', pay: 340 },
  { title: 'Mission 3 — The Drop', pay: 1240 },
  { title: 'Mission 4 — Dockside Heat', pay: 890 },
  { title: 'Mission 5 — Double Cross', pay: 1100 },
  { title: 'Mission 6 — Payback', pay: 1600 },
  { title: 'Mission 7 — King of Solmar', pay: 2500 },
];

const MARINA = { x: 140, z: -24 }; // the fare's drop-off, on the land by the basin
const DOCKS = { x: 0, z: 150 }; // the delivery point, on the street by the warehouses
const PLAZA_EDGE = { x: 0, z: -46 }; // the finale's drive target, just north of the plaza

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// A point on the road lattice near (px, pz), about `dist` metres away: pick
// the closest point on the nearest vertical or horizontal street. Cars stay
// off the fountain plaza, so a point inside the disc is pushed out along
// its street.
function streetPointNear(px, pz, dist) {
  const nearest = (v) => STREETS.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
  const vx = nearest(px);
  const hz = nearest(pz);
  const cands = [
    { x: vx + 4.2, z: clamp(pz + dist, -188, 188), heading: 0 },
    { x: vx + 4.2, z: clamp(pz - dist, -188, 188), heading: Math.PI },
    { x: clamp(px + dist, -188, 188), z: hz + 4.2, heading: Math.PI / 2 },
    { x: clamp(px - dist, -188, 188), z: hz + 4.2, heading: -Math.PI / 2 },
  ];
  const offPlaza = cands.filter((c) => Math.hypot(c.x, c.z) > 46);
  const list = offPlaza.length ? offPlaza : cands;
  let best = list[0];
  let bestScore = Infinity;
  for (const c of list) {
    const score = Math.abs(Math.hypot(c.x - px, c.z - pz) - dist);
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export class Missions {
  constructor(scene, city, player, police, enemies) {
    this.scene = scene;
    this.city = city;
    this.player = player;
    this.police = police;
    this.enemies = enemies;
    this.index = 0; // jobs finished, 0 to 7; the next job is MISSIONS[index]
    this.step = 0; // phase inside the current job
    this.phase = 'active'; // active | banner | done
    this.floor = 0; // wanted level the job holds the player at, 0 for none
    this.vehicle = null; // the job's car, while it matters
    this.goons = []; // goons this job spawned
    this.waypoint = null; // { x, z } the beacon marks, or null
    this.spawnPoint = { x: 0, z: -60, heading: 0 }; // where this job began
    this.banner = null; // { text, t } while a completion/failure banner shows
    this.time = 0;
    this._objective = 'Explore Solmar Bay';
    // Dialogue hook: the main loop sets onLine(name, text, portrait) so
    // Rosa, Vince and dispatch can brief the jobs. Null means silent.
    this.onLine = null;
    // REP hook: the main loop sets onRep(amount, label) so job pay also
    // pays respect. Null means no REP is awarded.
    this.onRep = null;

    // The waypoint beacon: a tall column of light and a ring on the ground.
    // It is hidden until a job gives it a target.
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffc93e, transparent: true, opacity: 0.28,
      side: THREE.DoubleSide, depthWrite: false, fog: false,
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true), beamMat);
    beam.position.y = 30;
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffc93e, transparent: true, opacity: 0.85,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.2, 3.0, 24), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    this.beacon = new THREE.Group();
    this.beacon.add(beam);
    this.beacon.add(ring);
    this.beacon.visible = false;
    this.beaconMat = beamMat;
    this.beaconRing = ring;
    scene.add(this.beacon);
  }

  // --- What the HUD reads ----------------------------------------------------
  get title() {
    if (this.phase === 'done' || this.index >= MISSIONS.length) return 'KING OF SOLMAR';
    return MISSIONS[this.index].title;
  }

  get objective() {
    if (this.phase === 'done') return 'Solmar Bay is yours, Dario.';
    if (this.banner) return this.banner.text;
    return this._objective;
  }

  get bannerText() {
    return this.banner ? this.banner.text : null;
  }

  get done() {
    return this.phase === 'done';
  }

  get waypointDistance() {
    if (!this.waypoint) return null;
    return Math.hypot(this.player.x - this.waypoint.x, this.player.z - this.waypoint.z);
  }

  // Goons of this job still standing.
  goonsAlive() {
    let n = 0;
    for (const e of this.goons) if (e.state === 'alive') n++;
    return n;
  }

  // --- Starting a job --------------------------------------------------------
  reset() {
    this.banner = null;
    this.phase = 'active';
    this.start(0);
  }

  // Continue from a save: `completed` jobs are done, so the next one starts.
  restore(completed) {
    this.banner = null;
    const n = Math.max(0, Math.min(MISSIONS.length, completed ?? 0));
    if (n >= MISSIONS.length) {
      this.index = MISSIONS.length;
      this.player.mission = MISSIONS.length;
      this.phase = 'done';
      this.waypoint = null;
      this.beacon.visible = false;
      return;
    }
    this.phase = 'active';
    this.start(n);
  }

  // Hide the beacon when the game leaves play (the menu shows the city).
  suspend() {
    this.beacon.visible = false;
  }

  // Begin job `index` fresh: clear the last job's goons and cruisers, put
  // Dario back on full health with a full magazine, and set the job up.
  start(index) {
    this.index = index;
    this.player.mission = index;
    this.step = 0;
    this.phase = 'active';
    this.floor = 0;
    this.vehicle = null;
    this.goons = [];
    this.banner = null;
    this.spawnPoint = { x: this.player.x, z: this.player.z, heading: this.player.heading };
    this.enemies.clear();
    this.police.clearCruisers();
    this.police.setStars(0);
    this.player.health = 100;
    this.player.ammo = CFG.pistol.magazine;
    if (this.player.weapons.smg) this.player.ammoSmg = CFG.smg.magazine;
    if (this.player.weapons.shotgun) this.player.ammoShotgun = CFG.shotgun.magazine;
    this.player.carHealth = 100;

    // Rosa briefs every job in the dialogue box.
    const brief = (text) => {
      if (this.onLine) this.onLine('Rosa — Rosa\'s Garage', text, 'rosa');
    };

    if (index === 0) {
      // Sunset Fare: a Bay Cab waits nearby; drive the fare to the Marina.
      this.vehicle = this._spawnMissionCar('cab');
      this._objective = 'Get in the Bay Cab';
      this.waypoint = { x: this.vehicle.x, z: this.vehicle.z };
      brief("Dario, you're back. A fare's waiting at the cab — the Marina, and don't keep them waiting.");
    } else if (index === 1) {
      // Borrowed Wheels: three goons guard a Comet GT at the Plaza.
      this._spawnGoons([[18, 12], [-16, 20], [24, -14]]);
      this.vehicle = this._spawnMissionCarAt('comet', 30, 18, Math.PI);
      this._objective = 'Clear the goons at the Plaza';
      this.waypoint = { x: 0, z: 0 };
      brief('Some punks took our Comet GT. Clear them out and bring my car back.');
    } else if (index === 2) {
      // The Drop: a Comet GT waits nearby; deliver to the Docks with three
      // cruisers on the tail the whole way.
      this.vehicle = this._spawnMissionCar('comet');
      this.floor = 3;
      this._objective = 'Get in the Comet GT';
      this.waypoint = { x: this.vehicle.x, z: this.vehicle.z };
      brief("A drop at the Docks. Three stars on your tail the whole way — lose them, don't fight them.");
    } else if (index === 3) {
      // Dockside Heat: four goons hold the Docks; clear them at two stars.
      this._spawnGoons([[-24, 150], [24, 150], [-72, 150], [72, 150]]);
      this.floor = 2;
      this._objective = 'Clear the Docks';
      this.waypoint = { x: DOCKS.x, z: DOCKS.z };
      brief("The Docks are crawling with Vince's boys. Clear them out.");
    } else if (index === 4) {
      // Double Cross: Vince Marlowe calls a truce meeting at the Docks.
      // It is an ambush — four goons and three stars when Dario arrives.
      this._objective = 'Meet Vince at the Docks';
      this.waypoint = { x: DOCKS.x, z: DOCKS.z };
      brief("Vince wants to meet at the Docks — says it's a truce. I don't trust it. Watch your back.");
    } else if (index === 5) {
      // Payback: Vince's crew holds the Marina; take the Comet GT there
      // and clear them, with three stars on the tail.
      this.vehicle = this._spawnMissionCar('comet');
      this.floor = 3;
      this._objective = 'Take the Comet GT to the Marina';
      this.waypoint = { x: this.vehicle.x, z: this.vehicle.z };
      brief("Vince crossed us. His crew's at the Marina — make him pay.");
    } else if (index === 6) {
      // King of Solmar: take the Vault Hauler, drive it to the Plaza, then
      // clear the guards and take the city.
      this.vehicle = this._spawnMissionCar('hauler');
      this.floor = 3;
      this._objective = 'Take the Vault Hauler';
      this.waypoint = { x: this.vehicle.x, z: this.vehicle.z };
      brief('One last job, Dario. Take the Hauler to the Plaza, and this city is yours.');
    }
  }

  // --- One step, called every frame while playing ---------------------------
  update(dt) {
    this.time += dt;
    if (this.phase === 'done') return;

    if (this.phase === 'banner') {
      this.banner.t -= dt;
      if (this.banner.t <= 0) {
        const wasRestart = this.banner.restart;
        this.banner = null;
        if (this.index >= MISSIONS.length) {
          this.phase = 'done';
          this.waypoint = null;
          this.beacon.visible = false;
        } else if (wasRestart) {
          this.start(this.index);
        } else {
          this.start(this.index);
        }
      }
      return;
    }

    // Failing the job: Dario goes down, or the job's car is wrecked.
    if (this.player.health <= 0) {
      this.fail('Dario is down');
      return;
    }
    if (this.vehicle && this.player.car === this.vehicle && this.player.carHealth <= 0) {
      this.fail('The car is wrecked');
      return;
    }

    // The job holds the wanted level at its floor: re-assert it every frame,
    // because the police cool off on their own when they lose sight.
    if (this.floor > 0 && this.police.stars < this.floor) {
      this.police.setStars(this.floor);
    }

    const p = this.player;
    const near = (tx, tz, r) => Math.hypot(p.x - tx, p.z - tz) < r;

    if (this.index === 0) {
      // Sunset Fare.
      if (this.step === 0) {
        if (!p.onFoot && p.car && p.car.type === 'cab') {
          this.vehicle = p.car;
          this.step = 1;
          this._objective = 'Drive the fare to the Marina';
          this.waypoint = { x: MARINA.x, z: MARINA.z };
        }
      } else if (!p.onFoot && p.car === this.vehicle) {
        this._objective = 'Drive the fare to the Marina';
        this.waypoint = { x: MARINA.x, z: MARINA.z };
        if (near(MARINA.x, MARINA.z, 10)) this.complete();
      } else {
        this._objective = 'Get back in the Bay Cab';
        this.waypoint = { x: this.vehicle.x, z: this.vehicle.z };
      }
    } else if (this.index === 1) {
      // Borrowed Wheels.
      if (this.step === 0) {
        if (this.goonsAlive() === 0) {
          this.step = 1;
          this._objective = 'Take the Comet GT';
          this.waypoint = { x: this.vehicle.x, z: this.vehicle.z };
        }
      } else if (!p.onFoot && p.car === this.vehicle) {
        this.complete();
      }
    } else if (this.index === 2) {
      // The Drop.
      if (this.step === 0) {
        if (!p.onFoot && p.car && p.car.type === 'comet') {
          this.vehicle = p.car;
          this.step = 1;
          this._objective = 'Deliver to the Docks — outrun the cruisers';
          this.waypoint = { x: DOCKS.x, z: DOCKS.z };
          if (this.onLine) {
            this.onLine('Dispatch — Sgt. Fenn', 'All units, red Comet GT, southbound from the Plaza. Air support is on standby.', 'fenn');
          }
        }
      } else if (!p.onFoot && p.car === this.vehicle) {
        this._objective = 'Deliver to the Docks — outrun the cruisers';
        this.waypoint = { x: DOCKS.x, z: DOCKS.z };
        if (near(DOCKS.x, DOCKS.z, 10)) this.complete();
      } else {
        this._objective = 'Get back in the Comet GT';
        this.waypoint = { x: this.vehicle.x, z: this.vehicle.z };
      }
    } else if (this.index === 3) {
      // Dockside Heat.
      if (this.goonsAlive() === 0) this.complete();
    } else if (this.index === 4) {
      // Double Cross: the truce is a trap. Reaching the Docks springs
      // the ambush — four goons and three stars.
      if (this.step === 0) {
        if (near(DOCKS.x, DOCKS.z, 10)) {
          this.step = 1;
          this.floor = 3;
          // All four on the open street in front of the warehouses: the
          // warehouse walls block shots, so a goon inside one could never
          // be hit and the job could never be finished.
          this._spawnGoons([[-24, 150], [24, 150], [-48, 150], [48, 150]]);
          this._objective = 'Ambush! Clear the Docks';
          this.waypoint = { x: DOCKS.x, z: DOCKS.z };
          if (this.onLine) {
            this.onLine('Vince Marlowe', "You should've stayed gone, Cruz. Boys — take him down!", 'vince');
          }
        }
      } else if (this.goonsAlive() === 0) {
        this.complete();
      }
    } else if (this.index === 5) {
      // Payback: drive the Comet GT to the Marina, then clear Vince's crew.
      if (this.step === 0) {
        if (!p.onFoot && p.car && p.car.type === 'comet') {
          this.vehicle = p.car;
          this.step = 1;
          this._objective = 'Drive to the Marina';
          this.waypoint = { x: MARINA.x, z: MARINA.z };
        }
      } else if (this.step === 1) {
        if (!p.onFoot && p.car === this.vehicle) {
          this._objective = 'Drive to the Marina';
          this.waypoint = { x: MARINA.x, z: MARINA.z };
          if (near(MARINA.x, MARINA.z, 12)) {
            this.step = 2;
            // On the open streets by the basin — never inside a building
            // or in the water, where a goon could not be hit or reached.
            this._spawnGoons([[120, -48], [132, -24], [144, -48], [144, 0]]);
            this._objective = "Clear the Marina — Vince's crew";
            this.waypoint = { x: MARINA.x, z: MARINA.z };
          }
        } else {
          this._objective = 'Get back in the Comet GT';
          this.waypoint = { x: this.vehicle.x, z: this.vehicle.z };
        }
      } else if (this.goonsAlive() === 0) {
        this.complete();
      }
    } else if (this.index === 6) {
      // King of Solmar.
      if (this.step === 0) {
        if (!p.onFoot && p.car && p.car.type === 'hauler') {
          this.vehicle = p.car;
          this.step = 1;
          this._objective = 'Drive the Hauler to the Plaza';
          this.waypoint = { x: PLAZA_EDGE.x, z: PLAZA_EDGE.z };
        }
      } else if (this.step === 1) {
        if (!p.onFoot && p.car === this.vehicle) {
          this._objective = 'Drive the Hauler to the Plaza';
          this.waypoint = { x: PLAZA_EDGE.x, z: PLAZA_EDGE.z };
          if (near(PLAZA_EDGE.x, PLAZA_EDGE.z, 10)) {
            this.step = 2;
            this.floor = 2;
            this._spawnGoons([[-18, -12], [18, -12], [0, -22]]);
            this._objective = 'Clear the Plaza — take the city';
            this.waypoint = { x: 0, z: -12 };
          }
        } else {
          this._objective = 'Get back in the Vault Hauler';
          this.waypoint = { x: this.vehicle.x, z: this.vehicle.z };
        }
      } else if (this.goonsAlive() === 0) {
        this.complete();
      }
    }

    // The beacon marks the target and pulses while the job runs.
    if (this.waypoint) {
      this.beacon.visible = true;
      this.beacon.position.set(this.waypoint.x, 0, this.waypoint.z);
      this.beaconMat.opacity = 0.22 + Math.sin(this.time * 3) * 0.08;
      this.beaconRing.rotation.z = this.time * 0.4;
    } else {
      this.beacon.visible = false;
    }
  }

  // --- Finishing a job --------------------------------------------------------
  complete() {
    const job = MISSIONS[this.index];
    this.player.cash += job.pay;
    // Every job pays respect as well as cash.
    const rep = CFG.repForMission[this.index] ?? 0;
    this.player.rep += rep;
    if (this.onRep) this.onRep(rep, job.title);
    // Weapon unlocks: the SMG after job 2, the shotgun after job 4.
    if (this.index === 1 && !this.player.weapons.smg) {
      this.player.weapons.smg = true;
      this.player.ammoSmg = CFG.smg.magazine;
      if (this.onLine) {
        this.onLine('Rosa — Rosa\'s Garage', 'Nice work. Take the Squall SMG from the locker — slot 2. You\'ll need it.', 'rosa');
      }
    }
    if (this.index === 3 && !this.player.weapons.shotgun) {
      this.player.weapons.shotgun = true;
      this.player.ammoShotgun = CFG.shotgun.magazine;
      if (this.onLine) {
        this.onLine('Rosa — Rosa\'s Garage', "Breaker 12 is yours now — slot 3. Vince won't stop at the Docks.", 'rosa');
      }
    }
    this.index += 1;
    this.player.mission = this.index;
    this.floor = 0;
    this.waypoint = null;
    this.beacon.visible = false;
    this.vehicle = null;
    this.goons = [];
    this.enemies.clear();
    this.phase = 'banner';
    if (this.index >= MISSIONS.length) {
      this.banner = { text: `KING OF SOLMAR — +$${job.pay.toLocaleString('en-US')}`, t: 4, restart: false };
    } else {
      this.banner = { text: `MISSION COMPLETE — +$${job.pay.toLocaleString('en-US')}`, t: 3.5, restart: false };
    }
  }

  // --- Failing a job ----------------------------------------------------------
  fail(reason) {
    this.phase = 'banner';
    this.banner = { text: `JOB FAILED — ${reason}. The job restarts.`, t: 3, restart: true };
    this.floor = 0;
    this.waypoint = null;
    this.beacon.visible = false;
    this.enemies.clear();
    this.police.clearCruisers();
    this.police.setStars(0);
    if (this.vehicle) {
      this.vehicle.taken = false;
      this.scene.remove(this.vehicle.mesh);
      const i = this.city.parkedCars.indexOf(this.vehicle);
      if (i !== -1) this.city.parkedCars.splice(i, 1);
      this.vehicle = null;
    }
    this.goons = [];
    this.player.health = 100;
    this.player.ammo = CFG.pistol.magazine;
    if (this.player.weapons.smg) this.player.ammoSmg = CFG.smg.magazine;
    if (this.player.weapons.shotgun) this.player.ammoShotgun = CFG.shotgun.magazine;
    this.player.carHealth = 100;
    this.player.spawn(this.spawnPoint.x, this.spawnPoint.z, this.spawnPoint.heading);
  }

  // --- Spawning ---------------------------------------------------------------
  _spawnMissionCar(type) {
    const spot = streetPointNear(this.player.x, this.player.z, 22);
    return this._spawnMissionCarAt(type, spot.x, spot.z, spot.heading);
  }

  _spawnMissionCarAt(type, x, z, heading) {
    const spec = CFG.cars[type];
    const mesh = buildCarMesh(spec.body, spec.color, type);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = { type, spec, x, z, heading, mesh, taken: false };
    this.city.parkedCars.push(car);
    return car;
  }

  _spawnGoons(positions) {
    for (const [x, z] of positions) {
      this.goons.push(this.enemies.spawn(x, z));
    }
  }
}
