import * as THREE from "three";
import { GameAudio } from "./audio";
import { CAMERA, CARS, DRIVE, ROAD, SPAWN, type CarId } from "./tuning";
import { hits, nearMissClearance } from "./collision";
import { InputController } from "./input";
import { clamp, damp, formatDistance, formatScore, laneCenter } from "./math";
import {
  materializePattern,
  pickPattern,
  type TrafficCar,
} from "./patterns";
import { applyUnlocks, commitRun, loadSave, writeSave, type SaveData } from "./save";
import {
  difficultyAt,
  distanceScore,
  nearMissScore,
  overtakeScore,
  registerNearMiss,
  tickCombo,
} from "./scoring";
import { emptyRun, type GameMode, type RunStats } from "./state";
import { createFormulaCar, createTrafficCar } from "./vehicles";
import { TrackWorld, zoneAt } from "./world";

type Toast = { text: string; life: number; color: string };

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(CAMERA.fovIdle, 1, 0.1, 420);
  readonly input = new InputController();
  readonly audio = new GameAudio();

  save: SaveData = loadSave();
  mode: GameMode = "title";
  run: RunStats = emptyRun();
  toasts: Toast[] = [];
  fps = 60;
  lastBest = false;

  private world: TrackWorld;
  private playerMesh: THREE.Group;
  private traffic: TrafficCar[] = [];
  private trafficMeshes = new Map<TrafficCar, THREE.Object3D>();
  private meshPool = new Map<TrafficCar["kind"], THREE.Object3D[]>();
  private player = { x: 0, z: 0, vx: 0, speed: 0, yaw: 0 };
  private spawnClock = 0.6;
  private countdown = 0;
  private crashTimer = 0;
  private shake = 0;
  private clock = new THREE.Clock();
  private camPos = new THREE.Vector3(0, CAMERA.height, -CAMERA.back);
  private look = new THREE.Vector3();
  private speedLines: THREE.Points;
  private ui: Record<string, HTMLElement>;
  private frames = 0;
  private fpsAccum = 0;
  private hidden = false;

  constructor(canvas: HTMLCanvasElement, ui: Record<string, HTMLElement>) {
    this.ui = ui;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;

    this.world = new TrackWorld(this.scene);
    this.playerMesh = createFormulaCar(CARS[0].color, CARS[0].accent);
    this.scene.add(this.playerMesh);
    this.speedLines = this.makeSpeedLines();
    this.scene.add(this.speedLines);

    this.input.attach(canvas);
    this.bindUi();
    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.renderTitle();
    this.tick();
  }

  startRun() {
    void this.audio.resume();
    this.audio.playUi();
    this.run = emptyRun();
    this.player = { x: 0, z: 0, vx: 0, speed: DRIVE.startSpeed, yaw: 0 };
    for (const car of this.traffic) this.release(car);
    this.traffic = [];
    this.spawnClock = 1.6;
    this.countdown = 3.15;
    this.crashTimer = 0;
    this.shake = 0;
    this.lastBest = false;
    this.mode = "countdown";
    this.audio.startEngine();
    this.setVisible("title", false);
    this.setVisible("results", false);
    this.setVisible("settings", false);
    this.setVisible("pause", false);
    this.setVisible("hud", true);
    this.setVisible("touch", this.touchy());
  }

  private tick = () => {
    requestAnimationFrame(this.tick);
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, DRIVE.hitchMaxDt);
    this.frames += 1;
    this.fpsAccum += raw;
    if (this.fpsAccum >= 0.4) {
      this.fps = this.frames / this.fpsAccum;
      this.frames = 0;
      this.fpsAccum = 0;
    }
    if (!this.hidden) this.simulate(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private simulate(dt: number) {
    const input = this.input.consume();
    if (input.pause && this.mode === "playing") this.setPause(true);
    else if (input.pause && this.mode === "paused") this.setPause(false);

    if (this.mode === "countdown") {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      this.ui.countdown.textContent = this.countdown > 0.28 ? String(Math.max(1, n)) : "GO";
      this.setVisible("countdown", true);
      if (this.countdown <= 0) {
        this.mode = "playing";
        this.setVisible("countdown", false);
        this.audio.playGo();
      } else if (Math.floor(this.countdown + dt) !== Math.floor(this.countdown) && this.countdown > 0.28) {
        this.audio.playCountdown(4 - n);
      }
      this.drive(dt, input.steer, input.brake, false);
      this.world.update(this.player.z, this.run.distance);
      this.sync(dt);
      return;
    }

    if (this.mode === "playing") {
      if (input.boost) this.tryBoost();
      this.drive(dt, input.steer, input.brake, true);
      this.updateTraffic(dt);
      this.world.update(this.player.z, this.run.distance);
      this.audio.update(this.player.speed, this.run.boosting);
      this.sync(dt);
      return;
    }

    if (this.mode === "crashed") {
      this.crashTimer -= dt;
      this.shake = Math.max(0, this.crashTimer);
      this.world.update(this.player.z, this.run.distance);
      this.sync(dt);
      if (this.crashTimer <= 0) this.openResults();
    }
  }

  private drive(dt: number, steer: number, brake: number, scoring: boolean) {
    const car = CARS.find((item) => item.id === this.save.selectedCar) ?? CARS[0];
    if (this.run.boosting) {
      this.run.boost = Math.max(0, this.run.boost - DRIVE.boostDrain * dt);
      if (this.run.boost <= 0) this.run.boosting = false;
    }
    const top = car.topSpeed * (this.run.boosting ? DRIVE.boostMultiplier : 1);
    this.player.speed =
      brake > 0.2
        ? Math.max(38, this.player.speed - car.brake * dt)
        : Math.min(top, this.player.speed + car.accel * dt);

    const authority = 1 - DRIVE.highSpeedSteerLoss * clamp(this.player.speed / car.topSpeed, 0, 1);
    this.player.vx = damp(this.player.vx, steer * car.steer * authority, car.grip, dt);
    this.player.x = clamp(this.player.x + this.player.vx * dt, -ROAD.driveLimit, ROAD.driveLimit);
    this.player.z += (this.player.speed / 3.6) * dt;
    this.player.yaw = damp(this.player.yaw, steer * 10, 10, dt);
    this.run.speed = this.player.speed;
    if (!scoring) return;

    const combo = tickCombo(this.run.combo, this.run.comboTimer, dt);
    this.run.combo = combo.combo;
    this.run.comboTimer = combo.timer;
    const dz = (this.player.speed / 3.6) * dt;
    this.run.distance += dz;
    this.run.score += distanceScore(dz, this.player.speed, car.topSpeed);
    this.player.x = clamp(this.player.x, -ROAD.driveLimit, ROAD.driveLimit);
  }

  private updateTraffic(dt: number) {
    const diff = difficultyAt(this.run.distance);
    this.spawnClock -= dt;
    if (this.spawnClock <= 0 && this.run.distance > SPAWN.introSafeDistance) {
      this.spawn(diff.trafficSpeed, diff.moverChance);
      this.spawnClock = diff.spawnInterval;
    }

    const playerBody = {
      x: this.player.x,
      z: this.player.z,
      vx: this.player.vx,
      vz: this.player.speed / 3.6,
      width: DRIVE.playerWidth,
      length: DRIVE.playerLength,
    };

    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const car = this.traffic[i];
      car.weavePhase += dt * 1.7;
      const weave = car.weave ? Math.sin(car.weavePhase) * car.weave : 0;
      const targetX = laneCenter(car.lane, ROAD.laneWidth, ROAD.laneCount) + weave;
      car.x += (targetX - car.x) * Math.min(1, dt * 3.2);
      car.z += (car.speed / 3.6) * dt;
      const other = {
        x: car.x,
        z: car.z,
        vx: 0,
        vz: car.speed / 3.6,
        width: DRIVE.trafficWidth,
        length: DRIVE.trafficLength,
      };
      if (hits(playerBody, other, dt)) {
        this.crash();
        return;
      }
      if (!car.nearMissed) {
        const gap = nearMissClearance(playerBody, other);
        if (gap !== null && car.z < this.player.z) {
          car.nearMissed = true;
          this.awardNearMiss(gap);
        }
      }
      if (!car.passed && car.z < this.player.z) {
        car.passed = true;
        this.awardOvertake(Math.abs(this.player.x - car.x));
      }
      if (car.z < this.player.z - SPAWN.despawnBehind) {
        this.release(car);
        this.traffic.splice(i, 1);
      }
    }
  }

  private spawn(baseSpeed: number, moverChance: number) {
    const lookahead = Math.max(SPAWN.minLookahead, (this.player.speed / 3.6) * SPAWN.lookaheadSeconds);
    const pattern = pickPattern(this.run.distance, Math.random);
    const cars = materializePattern(pattern, this.player.z + lookahead, baseSpeed, moverChance, Math.random);
    for (const car of cars) {
      this.traffic.push(car);
      const mesh = this.acquire(car.kind);
      mesh.visible = true;
      mesh.position.set(car.x, 0, car.z);
      this.trafficMeshes.set(car, mesh);
    }
  }

  private awardNearMiss(clearance: number) {
    const next = registerNearMiss(this.run.combo);
    this.run.combo = next.combo;
    this.run.comboTimer = next.timer;
    this.run.maxCombo = Math.max(this.run.maxCombo, this.run.combo);
    this.run.nearMisses += 1;
    const points = nearMissScore(this.run.combo, clearance);
    this.run.score += points;
    this.run.boost = clamp(this.run.boost + DRIVE.boostNearMissCharge * (0.75 + this.run.combo * 0.06), 0, 1);
    this.pushToast(`NEAR MISS ×${this.run.combo}`, "#39FF14");
    this.audio.playNearMiss(this.run.combo);
    this.buzz(12);
    this.shake = Math.max(this.shake, 0.16);
  }

  private awardOvertake(lateral: number) {
    this.run.overtakes += 1;
    const points = overtakeScore(this.run.combo);
    this.run.score += points;
    if (lateral < 4.2) {
      this.pushToast(`OVERTAKE +${points}`, "#00E5FF");
      this.audio.playOvertake();
    }
  }

  private tryBoost() {
    if (this.mode !== "playing" || this.run.boosting || this.run.boost < DRIVE.boostMinCharge) return;
    this.run.boosting = true;
    this.audio.playBoost();
    this.buzz(18);
  }

  private crash() {
    if (this.mode !== "playing") return;
    this.mode = "crashed";
    this.crashTimer = 0.85;
    this.run.boosting = false;
    this.shake = 0.65;
    this.audio.playCrash();
    this.buzz(40);
  }

  private openResults() {
    this.mode = "results";
    const previous = this.save.bestScore;
    this.save = commitRun(this.save, {
      score: this.run.score,
      distance: this.run.distance,
      combo: this.run.maxCombo,
    });
    writeSave(this.save);
    this.lastBest = this.run.score > previous;
    if (this.lastBest) this.audio.playBest();
    this.setVisible("hud", false);
    this.setVisible("touch", false);
    this.setVisible("results", true);
    this.renderResults();
    this.renderTitle();
  }

  private setPause(paused: boolean) {
    this.mode = paused ? "paused" : "playing";
    this.setVisible("pause", paused);
    if (paused) this.audio.update(0, false);
  }

  private sync(dt: number) {
    this.playerMesh.position.set(this.player.x, 0, this.player.z);
    this.playerMesh.rotation.y = THREE.MathUtils.degToRad(-this.player.yaw);
    this.playerMesh.rotation.z = THREE.MathUtils.degToRad(-this.player.vx * 0.55);
    for (const car of this.traffic) {
      this.trafficMeshes.get(car)?.position.set(car.x, 0, car.z);
    }

    const t = clamp(this.player.speed / 260, 0, 1);
    const extra = this.run.boosting && !this.save.reducedMotion ? CAMERA.fovBoostExtra : 0;
    this.camera.fov = THREE.MathUtils.damp(
      this.camera.fov,
      CAMERA.fovIdle + (CAMERA.fovFast - CAMERA.fovIdle) * t + extra,
      5,
      dt,
    );
    this.camera.updateProjectionMatrix();
    const desired = new THREE.Vector3(this.player.x * 0.32, CAMERA.height, this.player.z - CAMERA.back - t);
    this.camPos.lerp(desired, 1 - Math.exp(-CAMERA.follow * dt));
    if (!this.save.reducedMotion && this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      this.camPos.x += (Math.random() - 0.5) * this.shake * 0.7;
    }
    this.camera.position.copy(this.camPos);
    this.look.set(this.player.x * 0.18, 0.65, this.player.z + CAMERA.lookAhead);
    this.camera.lookAt(this.look);

    const pos = this.speedLines.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      let z = pos.getZ(i) - this.player.speed * dt * 0.1;
      if (z < -16) z = 36 + Math.random() * 24;
      pos.setXYZ(i, this.player.x + (Math.random() - 0.5) * 7, 0.5 + Math.random() * 2, this.player.z + z);
    }
    pos.needsUpdate = true;
    this.speedLines.visible =
      !this.save.reducedMotion && this.player.speed > 140 && this.mode === "playing";

    this.toasts = this.toasts.filter((toast) => {
      toast.life -= dt;
      return toast.life > 0;
    });
    this.updateHud();
  }

  private acquire(kind: TrafficCar["kind"]) {
    const pool = this.meshPool.get(kind) ?? [];
    const mesh = pool.pop() ?? createTrafficCar(kind);
    this.meshPool.set(kind, pool);
    mesh.visible = true;
    if (!mesh.parent) this.scene.add(mesh);
    return mesh;
  }

  private release(car: TrafficCar) {
    const mesh = this.trafficMeshes.get(car);
    if (!mesh) return;
    mesh.visible = false;
    const pool = this.meshPool.get(car.kind) ?? [];
    pool.push(mesh);
    this.meshPool.set(car.kind, pool);
    this.trafficMeshes.delete(car);
  }

  private makeSpeedLines() {
    const count = 64;
    const array = new Float32Array(count * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(array, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0x8befff, size: 0.08, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    points.visible = false;
    return points;
  }

  private pushToast(text: string, color: string) {
    this.toasts.unshift({ text, life: 1.1, color });
    this.toasts = this.toasts.slice(0, 3);
  }

  private buzz(ms: number) {
    if (this.save.haptics) navigator.vibrate?.(ms);
  }

  private updateHud() {
    if (this.mode !== "playing" && this.mode !== "countdown" && this.mode !== "paused") return;
    this.ui.speed.textContent = String(Math.round(this.run.speed));
    this.ui.distance.textContent = formatDistance(this.run.distance);
    this.ui.score.textContent = formatScore(this.run.score);
    this.ui.combo.textContent = this.run.combo > 0 ? `×${this.run.combo}` : "";
    this.ui.zone.textContent = zoneAt(this.run.distance).name;
    const fill = this.ui.boostFill;
    fill.style.width = `${Math.round(this.run.boost * 100)}%`;
    fill.classList.toggle("ready", this.run.boost >= DRIVE.boostMinCharge);
    this.ui.toast.innerHTML = this.toasts
      .map((toast) => `<div style="color:${toast.color}">${toast.text}</div>`)
      .join("");
  }

  private renderTitle() {
    this.ui.cars.innerHTML = CARS.map((car) => {
      const unlocked = this.save.unlockedCars.includes(car.id);
      const selected = this.save.selectedCar === car.id;
      return `<button class="car ${selected ? "selected" : ""} ${unlocked ? "" : "locked"}" data-car="${car.id}" ${unlocked ? "" : "disabled"}>
        <strong>${car.name}</strong>
        <span>${car.blurb}</span>
        <em>${unlocked ? `${car.topSpeed} kph` : `Unlock at ${car.unlockBest} m`}</em>
      </button>`;
    }).join("");
    this.ui.best.textContent = `${formatScore(this.save.bestScore)} · ${formatDistance(this.save.bestDistance)}`;
    this.applyCar(this.save.selectedCar);
  }

  private renderResults() {
    this.ui.resultScore.textContent = formatScore(this.run.score);
    this.ui.resultStats.textContent = `${formatDistance(this.run.distance)} · ${this.run.nearMisses} near misses · ${this.run.overtakes} overtakes · max ×${this.run.maxCombo}`;
    this.ui.resultBest.textContent = this.lastBest ? "NEW PERSONAL BEST" : `Best ${formatScore(this.save.bestScore)}`;
    this.ui.resultBest.classList.toggle("gold", this.lastBest);
  }

  private applyCar(id: CarId) {
    const def = CARS.find((car) => car.id === id) ?? CARS[0];
    this.scene.remove(this.playerMesh);
    this.playerMesh = createFormulaCar(def.color, def.accent);
    this.scene.add(this.playerMesh);
  }

  private bindUi() {
    this.ui.play.addEventListener("click", () => this.startRun());
    this.ui.again.addEventListener("click", () => this.startRun());
    this.ui.menu.addEventListener("click", () => this.toTitle());
    this.ui.resume.addEventListener("click", () => this.setPause(false));
    this.ui.quit.addEventListener("click", () => this.toTitle());
    this.ui.pauseHud.addEventListener("click", () => this.setPause(true));
    this.ui.openSettings.addEventListener("click", () => this.setVisible("settings", true));
    this.ui.closeSettings.addEventListener("click", () => this.setVisible("settings", false));
    this.ui.cars.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-car]");
      if (!button || button.disabled) return;
      this.save.selectedCar = button.dataset.car as CarId;
      this.save = applyUnlocks(this.save);
      writeSave(this.save);
      this.audio.playUi();
      this.renderTitle();
    });

    const sfx = this.ui.sfx as HTMLInputElement;
    const music = this.ui.music as HTMLInputElement;
    const motion = this.ui.motion as HTMLInputElement;
    const haptics = this.ui.haptics as HTMLInputElement;
    sfx.value = String(this.save.sfxVolume);
    music.value = String(this.save.musicVolume);
    motion.checked = this.save.reducedMotion;
    haptics.checked = this.save.haptics;
    const persist = () => {
      this.save.sfxVolume = Number(sfx.value);
      this.save.musicVolume = Number(music.value);
      this.save.reducedMotion = motion.checked;
      this.save.haptics = haptics.checked;
      this.audio.setVolumes(this.save.sfxVolume, this.save.musicVolume);
      writeSave(this.save);
    };
    sfx.addEventListener("input", persist);
    music.addEventListener("input", persist);
    motion.addEventListener("change", persist);
    haptics.addEventListener("change", persist);
    this.audio.setVolumes(this.save.sfxVolume, this.save.musicVolume);

    this.ui.brakeBtn.addEventListener("pointerdown", () => this.input.setBrakeButton(true));
    window.addEventListener("pointerup", () => this.input.setBrakeButton(false));
    this.ui.boostBtn.addEventListener("pointerdown", () => this.input.setBoostButton(true));
    this.ui.boostBtn.addEventListener("pointerup", () => this.input.setBoostButton(false));
  }

  private toTitle() {
    this.mode = "title";
    this.audio.stopEngine();
    this.setVisible("results", false);
    this.setVisible("pause", false);
    this.setVisible("hud", false);
    this.setVisible("touch", false);
    this.setVisible("countdown", false);
    this.setVisible("title", true);
    this.player = { x: 0, z: 0, vx: 0, speed: 0, yaw: 0 };
    this.world.update(0, 0);
    this.sync(0.016);
  }

  private setVisible(id: string, visible: boolean) {
    this.ui[id]?.classList.toggle("hidden", !visible);
  }

  private touchy() {
    return matchMedia("(pointer: coarse)").matches;
  }

  private resize = () => {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  };

  private onVisibility = () => {
    this.hidden = document.hidden;
    if (this.hidden && this.mode === "playing") this.setPause(true);
    this.clock.getDelta();
  };
}
