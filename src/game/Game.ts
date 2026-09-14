import * as THREE from "three";
import { GameAudio } from "./audio";
import { hits, nearMissClearance } from "./collision";
import { InputController } from "./input";
import { clamp, damp, formatDistance, formatScore, headingOffset, laneCenter } from "./math";
import { lanesBlockedNear, materializePattern, pickFairPattern, type TrafficCar } from "./patterns";
import { applyDoubleReward, canDoubleReward, shouldShowInterstitial, type RewardGrant } from "./ads";
import { commitRun, hasStoredSave, HUD_SKINS, loadSave, writeSave, type HudSkin, type SaveData } from "./save";
import {
  buyCar,
  buyLivery,
  buyPart,
  buyWorld,
  carAvailable,
  emptyCarGarage,
  fittedSpec,
  formatCredits,
  GLOWS,
  LIVERIES,
  ownsCar,
  ownsWorld,
  paintCar,
  paintGlow,
  paintRim,
  paintTrail,
  PARTS,
  partDelta,
  partRequirement,
  rankCost,
  RIMS,
  setCarNumber,
  TRAILS,
  WORLD_UNLOCK,
  worldAvailable,
  type PartId,
  type WorldId,
} from "./garage";
import {
  difficultyAt,
  distanceScore,
  nearMissScore,
  overtakeScore,
  registerNearMiss,
  tickCombo,
} from "./scoring";
import { emptyRun, type GameMode, type RunStats } from "./state";
import { ADS, BLOOM, CAMERA, CARS, CHASSIS, DRIVE, MAX_PART_RANK, ROAD, SPAWN, type CarId } from "./tuning";
import { createFormulaCar, createTrafficCar, disposeCar } from "./vehicles";
import { TrackWorld, worldById, zoneAt } from "./world";
import { makeNightEnv } from "./env";

function hex(color: number) {
  return `#${color.toString(16).padStart(6, "0")}`;
}

function parseHex(value: string): number {
  const raw = value.replace("#", "");
  const n = Number.parseInt(raw, 16);
  return Number.isFinite(n) ? n : 0x00e5ff;
}

type Toast = { text: string; life: number; color: string };

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(CAMERA.fovIdle, 1, 0.1, CAMERA.far);
  readonly input = new InputController();
  readonly audio = new GameAudio();

  save: SaveData = loadSave();
  mode: GameMode = "title";
  run: RunStats = emptyRun();
  toasts: Toast[] = [];
  fps = 60;
  lastBest = false;
  private lastCredits = 0;
  private lastGrant: RewardGrant | null = null;
  private garageCar: CarId = "apex";
  private garageFrom: "title" | "results" = "title";
  private railReturn: "title" | "garage" | "results" = "title";
  private buying = false;
  private adTimer: number | null = null;
  private adReturnFocus: HTMLElement | null = null;
  private paintTimer: number | null = null;
  private pendingBreak = false;

  private world: TrackWorld;
  private playerMesh: THREE.Group;
  private traffic: TrafficCar[] = [];
  private trafficMeshes = new Map<TrafficCar, THREE.Group>();
  private meshPool = new Map<TrafficCar["kind"], THREE.Group[]>();
  private player = { x: 0, z: 0, vx: 0, speed: 0, yaw: 0 };
  private chassis = { pitch: 0, roll: 0, y: 0, vy: 0 };
  private spawnClock = 0.6;
  private countdown = 0;
  private crashTimer = 0;
  private shake = 0;
  private clock = new THREE.Clock();
  private prevSpeed = 0;
  private boostPunch = 0;
  private fovKick = 0;
  private land = 0;
  private camRoll = 0;
  private camPos = new THREE.Vector3(0, CAMERA.height, -CAMERA.back);
  private look = new THREE.Vector3();
  private desiredCam = new THREE.Vector3();
  private lookMat = new THREE.Matrix4();
  private camQuat = new THREE.Quaternion();
  private trailTip = new THREE.Vector3();
  private trailHistory: THREE.Vector3[] = [];
  private speedLines: THREE.Points;
  private spray: THREE.Points;
  private sprayLife = new Float32Array(0);
  private boostTrail: THREE.Line;
  private boostGlow: THREE.Mesh;
  private boostLight: THREE.PointLight;
  private ui: Record<string, HTMLElement>;
  private frames = 0;
  private fpsAccum = 0;
  private hidden = false;
  private raf = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, ui: Record<string, HTMLElement>) {
    this.ui = ui;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x9ec4e0, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = BLOOM.exposure;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene.environment = makeNightEnv(this.renderer, worldById(this.save.selectedWorld));
    this.scene.environmentIntensity = 1.15;

    this.world = new TrackWorld(this.scene, worldById(this.save.selectedWorld));
    const paint = fittedSpec(this.save, this.save.selectedCar);
    this.playerMesh = createFormulaCar(paint.color, paint.accent, paint.secondary, {
      rim: paint.rim,
      number: paint.number,
      glow: paint.glow,
    });
    this.playerMesh.userData.paintKey = this.paintKey(this.save.selectedCar);
    this.scene.add(this.playerMesh);
    this.speedLines = this.makeSpeedLines();
    this.speedLines.visible = false;
    this.scene.add(this.speedLines);
    this.spray = this.makeSpray();
    this.scene.add(this.spray);
    this.boostTrail = this.makeBoostTrail();
    this.scene.add(this.boostTrail);
    this.boostGlow = this.makeBoostGlow();
    this.scene.add(this.boostGlow);
    this.boostLight = new THREE.PointLight(0xffd8a8, 0, 8, 2);
    this.scene.add(this.boostLight);

    this.input.attach(canvas);
    this.bindUi();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches && !hasStoredSave()) {
      this.save.reducedMotion = true;
      (this.ui.motion as HTMLInputElement).checked = true;
    }
    this.showRailPanel("title");
    this.resize();
    requestAnimationFrame(() => this.resize());
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.renderTitle();
    this.resetFeel();
    this.world.update(0, 0);
    this.sync(0.016);
    this.tick();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.renderer.setAnimationLoop(null);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  startRun() {
    if (this.adTimer !== null) return;
    if (this.consumeBreak("run")) return;
    void this.audio.resume();
    this.audio.playUi();
    this.run = emptyRun();
    this.player = { x: 0, z: 0, vx: 0, speed: DRIVE.startSpeed, yaw: 0 };
    for (const car of this.traffic) this.release(car);
    this.traffic = [];
    this.spawnClock = 1.6;
    this.countdown = 2.95;
    this.crashTimer = 0;
    this.shake = 0;
    this.lastBest = false;
    this.applyCar(this.save.selectedCar);
    this.mode = "countdown";
    this.resetFeel();
    this.audio.startEngine();
    this.setVisible("title", false);
    this.setVisible("results", false);
    this.setVisible("settings", false);
    this.setVisible("pause", false);
    this.setVisible("garage", false);
    this.setVisible("hud", true);
    this.setVisible("touch", this.touchy());
    this.setPlayingLayout(true);
  }

  private tick = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, DRIVE.hitchMaxDt);
    this.frames += 1;
    this.fpsAccum += raw;
    if (this.fpsAccum >= 0.4) {
      this.fps = this.frames / this.fpsAccum;
      this.frames = 0;
      this.fpsAccum = 0;
      this.adaptQuality();
    }
    if (!this.hidden) this.simulate(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private quality = 1;
  private qualityHold = 0;

  private adaptQuality() {
    if (this.qualityHold > 0) this.qualityHold -= 1;
    if (this.fps < 26 && this.quality > 0) {
      this.quality = 0;
      this.qualityHold = 20;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
      this.resize();
    } else if (this.qualityHold === 0 && this.fps > 54 && this.quality === 0) {
      this.quality = 1;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.resize();
    }
  }

  private simulate(dt: number) {
    const input = this.input.consume();
    if (input.pause && this.mode === "playing") this.setPause(true);
    else if (input.pause && this.mode === "paused") this.setPause(false);

    if (this.mode === "title" || this.mode === "results") {
      this.world.update(this.player.z, this.mode === "title" ? 0 : this.run.distance);
      this.sync(dt);
      return;
    }

    if (this.mode === "countdown") {
      this.countdown -= dt;
      const n = Math.min(3, Math.max(1, Math.ceil(this.countdown)));
      this.ui.countdown.textContent = this.countdown > 0.28 ? String(n) : "GO";
      this.setVisible("countdown", true);
      this.fovKick = 0;
      this.boostPunch = 0;
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
      this.world.update(this.player.z, this.run.distance);
      this.sync(dt);
      if (this.crashTimer <= 0) this.openResults();
    }
  }

  private spec() {
    return fittedSpec(this.save, this.save.selectedCar);
  }

  private drive(dt: number, steer: number, brake: number, scoring: boolean) {
    const car = this.spec();
    if (this.run.boosting) {
      this.run.boost = Math.max(0, this.run.boost - car.boostDrain * dt);
      if (this.run.boost <= 0) this.run.boosting = false;
    }
    const top = car.topSpeed * (this.run.boosting ? DRIVE.boostMultiplier : 1);
    const braking = brake > 0.12;
    this.player.speed = braking
      ? Math.max(DRIVE.minSpeed, this.player.speed - car.brake * clamp(brake, 0, 1) * dt)
      : Math.min(top, this.player.speed + car.accel * dt);

    const speedMs = this.player.speed / 3.6;
    const speedT = clamp(this.player.speed / car.topSpeed, 0, 1);
    const authority = 1 - DRIVE.highSpeedSteerLoss * speedT * car.steerLossScale;
    this.player.vx = damp(this.player.vx, steer * car.steer * authority, car.grip, dt);
    let nextX = this.player.x + this.player.vx * dt;
    if (nextX > ROAD.driveLimit) {
      nextX = ROAD.driveLimit;
      this.player.vx = Math.min(0, this.player.vx);
    } else if (nextX < -ROAD.driveLimit) {
      nextX = -ROAD.driveLimit;
      this.player.vx = Math.max(0, this.player.vx);
    }
    this.player.x = nextX;
    this.player.z += speedMs * dt;
    const yawTarget = clamp(this.player.vx * DRIVE.visualYawFromVx, -DRIVE.visualYawMax, DRIVE.visualYawMax);
    this.player.yaw = damp(this.player.yaw, yawTarget, DRIVE.visualYawDamp, dt);
    this.run.speed = this.player.speed;
    this.updateChassis(dt, steer, brake);
    this.prevSpeed = this.player.speed;
    if (!scoring) return;

    const combo = tickCombo(this.run.combo, this.run.comboTimer, dt);
    this.run.combo = combo.combo;
    this.run.comboTimer = combo.timer;
    const dz = speedMs * dt;
    this.run.distance += dz;
    this.run.score += distanceScore(dz, this.player.speed, car.topSpeed);
  }

  private updateChassis(dt: number, steer: number, brake: number) {
    const motion = this.save.reducedMotion ? 0.28 : 1;
    const accel = (this.player.speed - this.prevSpeed) / Math.max(dt, 1 / 120);
    const pitchAccel = clamp(-accel * CHASSIS.pitchAccel, -CHASSIS.pitchMax, CHASSIS.pitchMax);
    const pitchBrake = brake > 0.12 ? CHASSIS.pitchBrake : 0;
    const pitchBoost = this.run.boosting ? -CHASSIS.pitchBoost : 0;
    const targetPitch = (pitchAccel + pitchBrake + pitchBoost) * motion;
    const targetRoll = clamp(
      (-this.player.vx * CHASSIS.rollVx - steer * 0.04) * motion,
      -CHASSIS.rollMax,
      CHASSIS.rollMax,
    );
    this.chassis.pitch = damp(this.chassis.pitch, targetPitch, CHASSIS.damp + 2, dt);
    this.chassis.roll = damp(this.chassis.roll, targetRoll, CHASSIS.damp + 4, dt);

    const targetY = this.run.boosting ? -CHASSIS.squat : 0;
    this.chassis.vy += (targetY - this.chassis.y) * CHASSIS.spring * dt;
    this.chassis.vy -= this.chassis.vy * CHASSIS.damp * dt;
    const prevY = this.chassis.y;
    this.chassis.y = clamp(this.chassis.y + this.chassis.vy * dt, -0.16, 0.08);
    if (prevY < -0.03 && this.chassis.vy > 0.55) {
      this.land = Math.max(this.land, clamp(this.chassis.vy * 0.4, 0, 1));
    }
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
    const origin = this.player.z + lookahead;
    const blocked = lanesBlockedNear(this.traffic, origin, 14);
    const pattern = pickFairPattern(this.run.distance, Math.random, blocked);
    if (!pattern) return;
    const cars = materializePattern(pattern, origin, baseSpeed, moverChance, Math.random);
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
    this.run.boost = clamp(this.run.boost + this.spec().boostNearMissCharge * (0.75 + this.run.combo * 0.06), 0, 1);
    this.pushToast(`NEAR MISS ×${this.run.combo}`, "#e8f0f8");
    this.audio.playNearMiss(this.run.combo);
    this.buzz(12);
    this.shake = Math.max(this.shake, 0.03);
  }

  private awardOvertake(lateral: number) {
    this.run.overtakes += 1;
    const points = overtakeScore(this.run.combo);
    this.run.score += points;
    if (lateral < 4.2) {
      this.pushToast(`OVERTAKE +${points}`, "#dce6f0");
      this.audio.playOvertake();
    }
  }

  private tryBoost() {
    if (this.mode !== "playing" || this.run.boosting || this.run.boost < this.spec().boostMinCharge) return;
    this.run.boosting = true;
    this.fovKick = Math.max(this.fovKick, CAMERA.fovBoostExtra);
    this.chassis.vy -= 1.55;
    this.audio.playBoost();
    this.buzz(18);
  }

  private crash() {
    if (this.mode !== "playing") return;
    this.mode = "crashed";
    this.crashTimer = 0.85;
    this.run.boosting = false;
    this.shake = 0.18;
    this.audio.playCrash();
    this.buzz(40);
    this.burstCrash();
  }

  private openResults() {
    this.mode = "results";
    if (this.run.settled) {
      this.setVisible("hud", false);
      this.setVisible("touch", false);
      this.setPlayingLayout(false);
      this.showRailPanel("results");
      this.renderResults();
      this.renderTitle();
      this.queueBreak();
      return;
    }
    this.run.settled = true;
    const previous = this.save.bestScore;
    const settled = commitRun(this.save, {
      id: this.run.id,
      score: this.run.score,
      distance: this.run.distance,
      combo: this.run.maxCombo,
      nearMisses: this.run.nearMisses,
      overtakes: this.run.overtakes,
    });
    this.save = settled.save;
    this.lastCredits = settled.earned;
    this.lastGrant = settled.duplicate
      ? { runId: this.run.id, baseCredits: 0, doubled: true }
      : { runId: this.run.id, baseCredits: settled.earned, doubled: this.save.lastRewardRunId === this.run.id };
    writeSave(this.save);
    this.lastBest = this.run.score > previous;
    if (this.lastBest) this.audio.playBest();
    if (settled.earned > 0) this.audio.playCoin();
    this.setVisible("hud", false);
    this.setVisible("touch", false);
    this.setPlayingLayout(false);
    this.showRailPanel("results");
    this.renderResults();
    this.renderTitle();
    this.queueBreak();
  }

  private setPause(paused: boolean) {
    this.mode = paused ? "paused" : "playing";
    this.setVisible("pause", paused);
    if (paused) {
      this.audio.update(0, false);
      this.ui.resume.focus();
    }
  }

  private sync(dt: number) {
    this.playerMesh.position.set(this.player.x, this.chassis.y, this.player.z);
    this.playerMesh.rotation.set(this.chassis.pitch, -this.player.yaw, this.chassis.roll);
    for (const car of this.traffic) {
      const mesh = this.trafficMeshes.get(car);
      if (!mesh) continue;
      mesh.position.set(car.x, 0, car.z);
      this.spinWheels(mesh, car.speed, dt);
    }
    this.spinWheels(this.playerMesh, this.player.speed, dt);
    this.updateCamera(dt);
    this.updateBoostFx(dt);
    this.updateSpeedLines(dt);
    this.updateSpray(dt);
    this.toasts = this.toasts.filter((toast) => {
      toast.life -= dt;
      return toast.life > 0;
    });
    this.paintToasts();
    this.updateHud();
  }

  private spinWheels(root: THREE.Object3D, speedKph: number, dt: number) {
    const v = speedKph / 3.6;
    root.traverse((obj) => {
      if (obj.userData.spin) {
        const radius = Number(obj.userData.radius) || 0.32;
        obj.rotation.x += (v / radius) * dt;
      }
    });
  }

  private updateCamera(dt: number) {
    const reduced = this.save.reducedMotion;
    const gridHold = this.mode === "title" || this.mode === "countdown";
    const poseSpeed = this.mode === "title" ? DRIVE.startSpeed : this.player.speed;
    const speedT = clamp(poseSpeed / 260, 0, 1);
    const liveFeel = !gridHold && !reduced;
    const punchHold = liveFeel && this.run.boosting ? 0.38 : 0;
    this.boostPunch = gridHold ? 0 : damp(this.boostPunch, punchHold, 7.5, dt);
    this.fovKick = liveFeel ? Math.max(0, this.fovKick - dt * 14) : 0;
    this.land = Math.max(0, this.land - dt * 3.6);
    const punch = liveFeel ? this.boostPunch : 0;
    const land = reduced || gridHold ? 0 : this.land;
    const extra = liveFeel && this.run.boosting ? CAMERA.fovBoostExtra : 0;
    const targetFov = gridHold
      ? CAMERA.fovIdle
      : CAMERA.fovIdle + (CAMERA.fovFast - CAMERA.fovIdle) * speedT + extra + (reduced ? 0 : this.fovKick);
    this.camera.fov = gridHold
      ? CAMERA.fovIdle
      : THREE.MathUtils.damp(this.camera.fov, targetFov, 5.4, dt);
    this.camera.updateProjectionMatrix();

    const heading = headingOffset(this.player.yaw, 1);
    this.desiredCam.set(
      this.player.x * 0.26 - heading.x * CAMERA.back * CAMERA.yawCam,
      CAMERA.height + speedT * 0.22 + this.chassis.y * 0.42 - punch * 0.1 - land * CAMERA.landDrop,
      this.player.z - CAMERA.back - speedT * 0.58 - punch * CAMERA.boostPunch,
    );
    if (gridHold) {
      this.camPos.copy(this.desiredCam);
    } else {
      this.camPos.x = damp(this.camPos.x, this.desiredCam.x, CAMERA.lag, dt);
      this.camPos.y = damp(this.camPos.y, this.desiredCam.y, CAMERA.follow, dt);
      this.camPos.z = damp(this.camPos.z, this.desiredCam.z, CAMERA.follow * 1.2, dt);
    }

    if (liveFeel && this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const t = this.clock.elapsedTime;
      const hit = this.shake * CAMERA.shakeMax * 4;
      this.camPos.x += Math.sin(t * 9.4) * hit;
      this.camPos.y += Math.cos(t * 7.1) * hit * 0.35;
    }

    this.look.set(
      this.player.x * 0.16 + this.chassis.roll * 1.4 + heading.x * CAMERA.lookAhead * CAMERA.yawLook,
      CAMERA.lookHeight + this.chassis.y * 0.55 + speedT * 0.05 - land * 0.1,
      this.player.z + CAMERA.lookAhead + speedT * 0.8 + punch * 0.55,
    );
    this.lookMat.lookAt(this.camPos, this.look, this.camera.up);
    this.camQuat.setFromRotationMatrix(this.lookMat);
    const rollTarget = reduced || gridHold
      ? 0
      : clamp(this.chassis.roll + this.player.vx * CAMERA.steerRoll, -CHASSIS.rollMax, CHASSIS.rollMax);
    this.camRoll = gridHold ? 0 : damp(this.camRoll, rollTarget, 10, dt);
    this.camera.position.copy(this.camPos);
    this.camera.quaternion.copy(this.camQuat);
    this.camera.rotateZ(this.camRoll);
  }

  private updateBoostFx(dt: number) {
    const live = this.run.boosting && this.mode === "playing" && !this.save.reducedMotion;
    const trailMat = this.boostTrail.material as THREE.LineBasicMaterial;
    const glowMat = this.boostGlow.material as THREE.MeshBasicMaterial;
    trailMat.opacity = damp(trailMat.opacity, live ? 0.34 : 0, 12, dt);
    glowMat.opacity = damp(glowMat.opacity, live ? 0.16 : 0, 11, dt);
    this.boostLight.intensity = damp(this.boostLight.intensity, live ? 0.07 : 0, 10, dt);
    this.boostLight.distance = 2.1;

    this.trailTip.set(this.player.x, 0.155 + this.chassis.y, this.player.z - 1.74);
    const pos = this.boostTrail.geometry.getAttribute("position");
    const slots = pos.count;
    if (this.trailHistory.length === 0 || this.trailHistory[0].distanceToSquared(this.trailTip) > 0.01) {
      const slot = this.trailHistory.length < slots ? new THREE.Vector3() : this.trailHistory.pop()!;
      slot.copy(this.trailTip);
      this.trailHistory.unshift(slot);
    } else {
      this.trailHistory[0].copy(this.trailTip);
    }
    const wake = 0.92;
    for (let i = 0; i < slots; i++) {
      const src = this.trailHistory[Math.min(i, Math.max(0, this.trailHistory.length - 1))] ?? this.trailTip;
      const t = i / Math.max(1, slots - 1);
      pos.setXYZ(i, src.x, this.trailTip.y - t * 0.02, this.trailTip.z - t * wake);
    }
    pos.needsUpdate = true;
    this.boostTrail.geometry.computeBoundingSphere();
    this.boostTrail.visible = trailMat.opacity > 0.02;
    this.boostGlow.visible = glowMat.opacity > 0.02;
    this.boostGlow.position.set(this.player.x, 0.168 + this.chassis.y, this.player.z - 1.76);
    this.boostGlow.scale.set(live ? 1.55 : 0.85, live ? 0.1 : 0.06, 0.78 + this.boostPunch * 0.08);
    this.boostLight.position.copy(this.boostGlow.position);
  }

  private resetFeel() {
    this.chassis = { pitch: 0, roll: 0, y: 0, vy: 0 };
    this.boostPunch = 0;
    this.fovKick = 0;
    this.land = 0;
    this.camRoll = 0;
    this.prevSpeed = this.player.speed;
    this.shake = 0;
    this.trailHistory = [];
    const speedT = clamp(DRIVE.startSpeed / 260, 0, 1);
    this.camPos.set(
      this.player.x * 0.26,
      CAMERA.height + speedT * 0.22,
      this.player.z - CAMERA.back - speedT * 0.58,
    );
    this.desiredCam.copy(this.camPos);
    this.look.set(
      this.player.x * 0.16,
      CAMERA.lookHeight + speedT * 0.05,
      this.player.z + CAMERA.lookAhead + speedT * 0.8,
    );
    this.lookMat.lookAt(this.camPos, this.look, this.camera.up);
    this.camQuat.setFromRotationMatrix(this.lookMat);
    this.camera.position.copy(this.camPos);
    this.camera.quaternion.copy(this.camQuat);
    this.camera.fov = CAMERA.fovIdle;
    this.camera.updateProjectionMatrix();
    (this.boostTrail.material as THREE.LineBasicMaterial).opacity = 0;
    (this.boostGlow.material as THREE.MeshBasicMaterial).opacity = 0;
    this.boostLight.intensity = 0;
    this.boostTrail.visible = false;
    this.boostGlow.visible = false;
    this.speedLines.visible = false;
    (this.speedLines.material as THREE.PointsMaterial).opacity = 0;
    this.spray.visible = false;
    (this.spray.material as THREE.PointsMaterial).opacity = 0;
    this.sprayLife.fill(1);
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
    const dashes = 6;
    const segs = 2;
    const array = new Float32Array(dashes * segs * 3);
    const streaks = new Float32Array(dashes * 3);
    const marks = [-ROAD.laneWidth, 0, ROAD.laneWidth];
    for (let i = 0; i < dashes; i++) {
      streaks[i * 3] = marks[i % marks.length];
      streaks[i * 3 + 1] = 0.02;
      streaks[i * 3 + 2] = -1 + i * 3.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(array, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x8e959c,
        size: 0.045,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    points.userData.streaks = streaks;
    points.userData.segs = segs;
    points.userData.dashLen = 1.15;
    points.visible = false;
    points.frustumCulled = false;
    return points;
  }

  private updateSpeedLines(dt: number) {
    const live = this.run.boosting && this.mode === "playing" && !this.save.reducedMotion;
    const mat = this.speedLines.material as THREE.PointsMaterial;
    mat.opacity = damp(mat.opacity, live ? 0.12 : 0, 11, dt);
    this.speedLines.visible = mat.opacity > 0.02;
    if (!this.speedLines.visible) return;
    const streaks = this.speedLines.userData.streaks as Float32Array;
    const segs = Number(this.speedLines.userData.segs) || 2;
    const dashLen = Number(this.speedLines.userData.dashLen) || 1.15;
    const pos = this.speedLines.geometry.getAttribute("position");
    const vz = this.player.speed / 3.6;
    const marks = [-ROAD.laneWidth, 0, ROAD.laneWidth];
    const dashes = streaks.length / 3;
    for (let i = 0; i < dashes; i++) {
      streaks[i * 3 + 2] -= vz * dt;
      if (streaks[i * 3 + 2] < -5.2) {
        streaks[i * 3] = marks[i % marks.length];
        streaks[i * 3 + 1] = 0.02;
        streaks[i * 3 + 2] = 14 + (i % 3) * 2.2;
      }
      const x = streaks[i * 3];
      const y = streaks[i * 3 + 1];
      const z0 = this.player.z + streaks[i * 3 + 2];
      for (let s = 0; s < segs; s++) {
        pos.setXYZ(i * segs + s, x, y, z0 + s * (dashLen / Math.max(1, segs - 1)));
      }
    }
    pos.needsUpdate = true;
  }

  private makeSpray() {
    const count = 14;
    this.sprayLife = new Float32Array(count);
    const array = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.sprayLife[i] = 1;
      array[i * 3] = 0;
      array[i * 3 + 1] = -1;
      array[i * 3 + 2] = 0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(array, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0x3a3630,
        size: 0.02,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    points.userData.vel = vel;
    points.visible = false;
    points.frustumCulled = false;
    return points;
  }

  private updateSpray(dt: number) {
    let laneOff = Infinity;
    for (let lane = 0; lane < ROAD.laneCount; lane++) {
      laneOff = Math.min(laneOff, Math.abs(this.player.x - laneCenter(lane, ROAD.laneWidth, ROAD.laneCount)));
    }
    const braking = this.input.brake > 0.12;
    const offline = laneOff > 0.72;
    const sliding = Math.abs(this.player.vx) > 4.5;
    const emit =
      this.mode === "playing" &&
      this.player.speed > 52 &&
      !this.save.reducedMotion &&
      (braking || offline || sliding);
    const mat = this.spray.material as THREE.PointsMaterial;
    mat.opacity = damp(mat.opacity, emit ? 0.22 : 0, 9, dt);
    this.spray.visible = mat.opacity > 0.02;
    if (!this.spray.visible) return;
    const pos = this.spray.geometry.getAttribute("position");
    const vel = this.spray.userData.vel as Float32Array;
    const kick = (braking ? 1.55 : 0.55) + (offline || sliding ? 0.4 : 0);
    for (let i = 0; i < pos.count; i++) {
      this.sprayLife[i] += dt * (3.4 + this.player.speed / 160);
      if (this.sprayLife[i] >= 1) {
        if (!emit) {
          pos.setXYZ(i, this.player.x, -1, this.player.z);
          continue;
        }
        this.sprayLife[i] = 0;
        const side = i % 2 === 0 ? -0.86 : 0.86;
        pos.setXYZ(
          i,
          this.player.x + side + (Math.random() - 0.5) * 0.04,
          0.018 + Math.random() * 0.012,
          this.player.z - 1.2 - Math.random() * 0.06,
        );
        vel[i * 3] = side * (0.18 + Math.random() * 0.16) + this.player.vx * 0.06;
        vel[i * 3 + 1] = 0.04 + Math.random() * 0.07;
        vel[i * 3 + 2] = -kick * (1.05 + Math.random() * 0.55);
      } else {
        vel[i * 3] *= Math.max(0, 1 - 2.4 * dt);
        vel[i * 3 + 1] -= 7.2 * dt;
        const y = Math.max(0.012, pos.getY(i) + vel[i * 3 + 1] * dt);
        pos.setXYZ(i, pos.getX(i) + vel[i * 3] * dt, y, pos.getZ(i) + vel[i * 3 + 2] * dt);
      }
    }
    pos.needsUpdate = true;
  }

  private makeBoostTrail() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(7 * 3), 3));
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xffe0b8,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: true,
      }),
    );
    line.visible = false;
    line.frustumCulled = false;
    return line;
  }

  private makeBoostGlow() {
    const geo = new THREE.ConeGeometry(0.16, 0.28, 5, 1, true);
    geo.rotateX(-Math.PI / 2);
    const glow = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0xffd8a0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      }),
    );
    glow.visible = false;
    glow.frustumCulled = false;
    return glow;
  }

  private pushToast(text: string, color: string) {
    this.toasts.unshift({ text, life: 1.6, color });
    this.toasts = this.toasts.slice(0, 3);
    this.paintToasts();
  }

  private paintToasts() {
    this.ui.toast.innerHTML = this.toasts
      .map((toast) => `<div style="color:${toast.color}">${toast.text}</div>`)
      .join("");
  }

  private buzz(ms: number) {
    if (this.save.haptics) navigator.vibrate?.(ms);
  }

  private updateHud() {
    if (this.mode !== "playing" && this.mode !== "countdown" && this.mode !== "paused") return;
    this.ui.speed.textContent = String(Math.round(this.run.speed));
    if (this.ui.gear) this.ui.gear.textContent = this.gearLabel(this.run.speed);
    if (this.ui.rpm) {
      const rpm = Math.round(800 + this.run.speed * 18 + (this.run.boosting ? 400 : 0));
      this.ui.rpm.textContent = `${Math.min(rpm, 7800)} RPM`;
    }
    if (this.ui.raceFill) {
      const pct = clamp(this.run.distance / 4200, 0, 1);
      this.ui.raceFill.style.width = `${Math.round(pct * 100)}%`;
    }
    this.ui.distance.textContent = formatDistance(this.run.distance);
    this.ui.score.textContent = formatScore(this.run.score);
    this.ui.combo.textContent = this.run.combo > 0 ? `×${this.run.combo}` : "";
    this.ui.zone.textContent = zoneAt(this.run.distance, this.world.circuit).name;
    const fill = this.ui.boostFill;
    fill.style.width = `${Math.round(this.run.boost * 100)}%`;
    fill.classList.toggle("ready", this.run.boost >= this.spec().boostMinCharge);
    this.ui.hud.dataset.speed = this.save.hudSpeedSide;
    this.ui.hud.dataset.skin = this.save.hudSkin;
  }

  private gearLabel(speed: number) {
    if (speed < 70) return "2";
    if (speed < 120) return "3";
    if (speed < 165) return "4";
    if (speed < 210) return "5";
    if (speed < 250) return "6";
    return "7";
  }

  private renderTitle() {
    this.ui.cars.innerHTML = CARS.map((car, index) => {
      const owned = ownsCar(this.save, car.id);
      const selected = this.save.selectedCar === car.id;
      const available = carAvailable(this.save, car.id);
      const spec = fittedSpec(this.save, car.id);
      const locked = !owned && !available;
      const speed = owned
        ? `${Math.round(spec.topSpeed)}`
        : available
          ? `${car.unlockCost.toLocaleString("en-US")}`
          : `${car.unlockBest.toLocaleString("en-US")}`;
      const unit = owned ? "kph" : available ? "CR" : "m";
      const line = owned ? car.blurb.split(".")[0] : available ? "Buy onto the grid" : "Locked";
      return `<button class="car ${selected && owned ? "selected" : ""} ${locked ? "locked" : ""}" data-car="${car.id}" style="--car:${hex(spec.color)}" ${locked ? "disabled" : ""}>
        <span class="car-num">${String(index + 1).padStart(2, "0")}</span>
        <strong>${car.name}</strong>
        <span>${line}</span>
        <em>${speed}<small>${unit}</small></em>
      </button>`;
    }).join("");
    this.ui.statScore.textContent = formatScore(this.save.bestScore);
    this.ui.statDistance.textContent = formatDistance(this.save.bestDistance);
    this.ui.statCredits.textContent = formatCredits(this.save.credits);
    this.renderWorlds();
    this.applyCar(this.save.selectedCar);
  }

  private renderResults() {
    this.ui.resultScore.textContent = formatScore(this.run.score);
    this.ui.resultDistance.textContent = formatDistance(this.run.distance);
    this.ui.resultNear.textContent = String(this.run.nearMisses);
    this.ui.resultPass.textContent = String(this.run.overtakes);
    this.ui.resultCombo.textContent = `×${this.run.maxCombo}`;
    this.ui.resultBest.textContent = this.lastBest ? "Personal best" : "Chequered";
    this.ui.resultBest.classList.toggle("gold", this.lastBest);
    this.ui.resultCredits.innerHTML = `+${formatCredits(this.lastCredits)} <span>${formatCredits(this.save.credits)} banked</span>`;
    const canDouble = canDoubleReward(this.lastGrant);
    this.ui.resultDouble?.toggleAttribute("disabled", !canDouble);
    this.ui.resultDouble?.classList.toggle("hidden", !canDouble && Boolean(this.lastGrant?.doubled));
    if (this.ui.resultAdNote) {
      this.ui.resultAdNote.textContent = canDouble
        ? "Double this payout once. Optional."
        : this.lastGrant?.doubled
          ? "Already doubled this run."
          : "";
    }
  }

  private renderGarage() {
    const row = this.save.garage[this.garageCar] ?? emptyCarGarage(this.garageCar);
    if (this.ui.garageCredits) this.ui.garageCredits.textContent = formatCredits(this.save.credits);
    if (this.ui.garageLadder) {
      this.ui.garageLadder.textContent =
        this.save.totalRuns === 0 && this.save.credits === 0
          ? "Race nights pay for spec"
          : "Four trees. One rank at a time.";
    }
    const spec = fittedSpec(this.save, this.garageCar);
    if (this.ui.garageSpecs) {
      this.ui.garageSpecs.innerHTML = `
        <div><dt>Top</dt><dd>${Math.round(spec.topSpeed)} kph</dd></div>
        <div><dt>Steer</dt><dd>${spec.steer.toFixed(0)}</dd></div>
        <div><dt>Accel</dt><dd>${spec.accel.toFixed(0)}</dd></div>
        <div><dt>Charge</dt><dd>${spec.boostNearMissCharge.toFixed(2)}</dd></div>`;
    }
    if (this.ui.garageCars) {
      this.ui.garageCars.innerHTML = CARS.map((car, index) => {
        const owned = ownsCar(this.save, car.id);
        const selected = this.garageCar === car.id;
        const available = carAvailable(this.save, car.id);
        const locked = !owned && !available;
        const spec = fittedSpec(this.save, car.id);
        const paint = hex(spec.color);
        const label = owned
          ? `${Math.round(spec.topSpeed)}`
          : available
            ? car.unlockCost.toLocaleString("en-US")
            : car.unlockBest >= 1000
              ? `${(car.unlockBest / 1000).toFixed(1)}k`
              : car.unlockBest.toLocaleString("en-US");
        return `<button class="car ${selected ? "selected" : ""} ${locked ? "locked" : ""}" data-garage-car="${car.id}" style="--car:${paint}" ${locked ? "disabled" : ""}>
          <span class="car-num">${String(index + 1).padStart(2, "0")}</span>
          <strong>${car.name}</strong>
          <em>${label}<small>${owned ? "kph" : available ? "CR" : "m"}</small></em>
        </button>`;
      }).join("");
    }
    const owned = ownsCar(this.save, this.garageCar);
    if (this.ui.garageParts) {
      this.ui.garageParts.innerHTML = owned
        ? PARTS.map((part) => {
            const rank = row[part.id];
            const maxed = rank >= MAX_PART_RANK;
            const cost = rankCost(rank + 1);
            const pct = Math.round((rank / MAX_PART_RANK) * 100);
            const locked = !maxed ? partRequirement(row, part.id, rank + 1) : null;
            const next = !maxed && !locked ? partDelta(part.id, rank, rank + 1) : locked ?? "Maxed";
            return `<button class="part ${locked ? "locked-req" : ""}" data-part="${part.id}" ${maxed || locked ? "disabled" : ""}>
              <div>
                <strong>${part.name}</strong>
                <span class="next">${next}</span>
                <div class="rank-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
              </div>
              <em>${maxed ? "Max" : locked ? "Locked" : formatCredits(cost)}</em>
            </button>`;
          }).join("")
        : `<p class="hint">Buy this car before you can spec it.</p>`;
    }
    if (this.ui.garageLiveries) {
      this.ui.garageLiveries.innerHTML = owned
        ? LIVERIES.filter((item) => item.car === this.garageCar)
            .map((item) => {
              const have = this.save.ownedLiveries.includes(item.id);
              const equipped = row.livery === item.id;
              return `<button class="livery ${equipped ? "selected" : ""}" data-livery="${item.id}" style="--car:${hex(item.color)}">
                <strong>${item.name}</strong>
                <em>${have ? (equipped ? "On" : "Equip") : formatCredits(item.cost)}</em>
              </button>`;
            })
            .join("")
        : "";
    }
    if (this.ui.garageTrails) {
      this.ui.garageTrails.innerHTML = owned
        ? TRAILS.map((item) => {
            const on = row.trail === item.color;
            return `<button class="livery ${on ? "selected" : ""}" data-trail="${item.color}" style="--car:${hex(item.color)}">
              <strong>${item.name}</strong>
              <em>${on ? "On" : "Set"}</em>
            </button>`;
          }).join("")
        : "";
    }
    if (this.ui.garageRims) {
      this.ui.garageRims.innerHTML = owned
        ? RIMS.map((item) => {
            const on = row.rim === item.color;
            return `<button class="livery ${on ? "selected" : ""}" data-rim="${item.color}" style="--car:${hex(item.color)}">
              <strong>${item.name}</strong>
              <em>${on ? "On" : "Set"}</em>
            </button>`;
          }).join("")
        : "";
    }
    if (this.ui.garageGlows) {
      this.ui.garageGlows.innerHTML = owned
        ? GLOWS.map((item) => {
            const on = row.glow === item.color;
            return `<button class="livery ${on ? "selected" : ""}" data-glow="${item.color}" style="--car:${hex(item.color)}">
              <strong>${item.name}</strong>
              <em>${on ? "On" : "Set"}</em>
            </button>`;
          }).join("")
        : "";
    }
    this.renderWorlds();
    const primary = this.ui.paintPrimary as HTMLInputElement | undefined;
    const secondary = this.ui.paintSecondary as HTMLInputElement | undefined;
    const accent = this.ui.paintAccent as HTMLInputElement | undefined;
    const number = this.ui.carNumber as HTMLInputElement | undefined;
    if (primary && secondary && accent) {
      const painting = document.activeElement === primary || document.activeElement === secondary || document.activeElement === accent;
      if (!painting) {
        primary.value = hex(row.primary);
        secondary.value = hex(row.secondary);
        accent.value = hex(row.accent);
      }
      this.ui.garagePaint?.classList.toggle("hidden", !owned);
    }
    if (number && document.activeElement !== number) {
      number.value = String(row.number);
      number.disabled = !owned;
    }
  }

  private paintKey(id: CarId) {
    const spec = fittedSpec(this.save, id);
    return `${id}:${spec.color}:${spec.secondary}:${spec.accent}:${spec.rim}:${spec.number}:${spec.trail}:${spec.glow}`;
  }

  private applyCar(id: CarId) {
    const spec = fittedSpec(this.save, id);
    const key = this.paintKey(id);
    const trailMat = this.boostTrail.material as THREE.LineBasicMaterial;
    trailMat.color.setHex(spec.trail);
    (this.boostGlow.material as THREE.MeshBasicMaterial).color.setHex(spec.trail);
    this.boostLight.color.setHex(spec.trail);
    if (this.playerMesh.userData.paintKey === key) return;
    const prev = this.playerMesh;
    this.scene.remove(prev);
    disposeCar(prev);
    this.playerMesh = createFormulaCar(spec.color, spec.accent, spec.secondary, {
      rim: spec.rim,
      number: spec.number,
      glow: spec.glow,
    });
    this.playerMesh.userData.paintKey = key;
    this.playerMesh.position.copy(prev.position);
    this.playerMesh.rotation.copy(prev.rotation);
    this.scene.add(this.playerMesh);
  }

  private worldChip(id: WorldId) {
    const def = WORLD_UNLOCK.find((item) => item.id === id) ?? WORLD_UNLOCK[0];
    const world = worldById(id);
    const owned = ownsWorld(this.save, id);
    const available = worldAvailable(this.save, id);
    const selected = this.save.selectedWorld === id;
    const locked = !owned && !available;
    const label = owned
      ? world.tagline.split(".")[0]
      : available
        ? formatCredits(def.unlockCost)
        : `${def.unlockBest.toLocaleString("en-US")} m`;
    return `<button class="world ${selected ? "selected" : ""} ${locked ? "locked" : ""}" data-world="${id}" style="--car:${hex(world.neon)}" ${locked ? "disabled" : ""}>
      <strong>${def.name}</strong>
      <em>${label}</em>
    </button>`;
  }

  private renderWorlds() {
    const html = WORLD_UNLOCK.map((item) => this.worldChip(item.id)).join("");
    if (this.ui.worlds) this.ui.worlds.innerHTML = html;
    if (this.ui.garageWorlds) this.ui.garageWorlds.innerHTML = html;
    if (this.ui.brandCircuit) this.ui.brandCircuit.textContent = worldById(this.save.selectedWorld).name;
    if (this.ui.adCircuit) this.ui.adCircuit.textContent = worldById(this.save.selectedWorld).name;
  }

  private applyCircuit() {
    const next = worldById(this.save.selectedWorld);
    if (this.world.circuit.id !== next.id) {
      this.world.setCircuit(next);
      const prev = this.scene.environment;
      this.scene.environment = makeNightEnv(this.renderer, next);
      if (prev && "dispose" in prev) prev.dispose();
      this.world.update(this.player.z, this.mode === "title" ? 0 : this.run.distance);
    }
    if (this.ui.brandCircuit) this.ui.brandCircuit.textContent = next.name;
    if (this.ui.adCircuit) this.ui.adCircuit.textContent = next.name;
  }

  private pickWorld(id: WorldId) {
    const result = buyWorld(this.save, id);
    this.save = result.save;
    if (result.ok) {
      writeSave(this.save);
      this.applyCircuit();
      this.audio.playUi();
    } else {
      this.pushToast(result.hint, "#ff8a9a");
      this.audio.playDeny();
    }
    if (this.ui.garageHint) this.ui.garageHint.textContent = result.hint;
    if (this.ui.gridHint) this.ui.gridHint.textContent = result.ok ? "" : result.hint;
    this.renderWorlds();
    this.renderTitle();
    this.renderGarage();
  }

  private openGarage(from: "title" | "results") {
    this.garageFrom = from;
    this.garageCar = this.save.selectedCar;
    this.showRailPanel("garage");
    if (this.ui.garageHint) {
      this.ui.garageHint.textContent =
        this.save.totalRuns === 0 && this.save.credits === 0
          ? "Race first. Credits come from the circuit."
          : "Early ranks are cheap. Full spec takes many nights.";
    }
    this.renderGarage();
  }

  private closeGarage() {
    if (this.garageFrom === "results") this.showRailPanel("results");
    else this.showRailPanel("title");
    this.renderTitle();
  }

  private persistGarage(hint: string, ok: boolean) {
    if (this.ui.garageHint) this.ui.garageHint.textContent = hint;
    if (!ok) {
      this.audio.playDeny();
      return;
    }
    writeSave(this.save);
    this.audio.playUpgrade();
    this.applyCar(this.save.selectedCar);
    this.renderGarage();
    this.renderTitle();
    this.renderResults();
  }

  private bindUi() {
    this.ui.play.addEventListener("click", () => this.startRun());
    this.ui.again.addEventListener("click", () => this.startRun());
    this.ui.menu.addEventListener("click", () => this.toTitle());
    this.ui.resume.addEventListener("click", () => this.setPause(false));
    this.ui.quit.addEventListener("click", () => this.toTitle());
    this.ui.pauseHud.addEventListener("click", () => this.setPause(true));
    this.ui.navHome.addEventListener("click", () => this.toTitle());
    this.ui.openSettings.addEventListener("click", () => this.showRailPanel("settings"));
    this.ui.closeSettings.addEventListener("click", () => this.showRailPanel(this.railReturn));
    this.ui.openGarage.addEventListener("click", () => this.openGarage(this.mode === "results" ? "results" : "title"));
    this.ui.openGarageResults?.addEventListener("click", () => this.openGarage("results"));
    this.ui.closeGarage?.addEventListener("click", () => this.closeGarage());
    this.bindTopTabs();
    this.bindSubtabs(this.ui.title);
    this.bindSubtabs(this.ui.garage);
    this.ui.cars.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-car]");
      if (!button || button.disabled) return;
      const id = button.dataset.car as CarId;
      if (ownsCar(this.save, id)) {
        this.save.selectedCar = id;
        writeSave(this.save);
        this.audio.playUi();
        this.renderTitle();
        return;
      }
      const result = buyCar(this.save, id);
      this.save = result.save;
      if (result.ok) {
        writeSave(this.save);
        this.audio.playUi();
        if (this.ui.gridHint) this.ui.gridHint.textContent = "";
      } else {
        this.pushToast(result.hint, "#ff8a9a");
        this.audio.playDeny();
        if (this.ui.gridHint) this.ui.gridHint.textContent = result.hint;
      }
      this.renderTitle();
    });
    this.ui.garageCars?.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-garage-car]");
      if (!button || button.disabled) return;
      const id = button.dataset.garageCar as CarId;
      if (ownsCar(this.save, id)) {
        this.garageCar = id;
        this.save.selectedCar = id;
        writeSave(this.save);
        this.renderGarage();
        this.renderTitle();
        return;
      }
      const result = buyCar(this.save, id);
      this.save = result.save;
      this.persistGarage(result.hint, result.ok);
      if (result.ok) this.garageCar = id;
    });
    this.ui.garageParts?.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-part]");
      if (!button || button.disabled) return;
      if (this.buying) return;
      this.buying = true;
      const result = buyPart(this.save, this.garageCar, button.dataset.part as PartId);
      this.save = result.save;
      this.persistGarage(result.hint, result.ok);
      if (result.ok) button.classList.add("bought");
      this.buying = false;
    });
    this.ui.garageLiveries?.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-livery]");
      if (!button) return;
      const result = buyLivery(this.save, button.dataset.livery ?? "");
      this.save = result.save;
      this.persistGarage(result.hint, result.ok);
    });
    const onWorld = (event: Event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-world]");
      if (!button || button.disabled) return;
      this.pickWorld(button.dataset.world as WorldId);
    };
    this.ui.worlds?.addEventListener("click", onWorld);
    this.ui.garageWorlds?.addEventListener("click", onWorld);
    this.ui.garageTrails?.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-trail]");
      if (!button) return;
      this.save = paintTrail(this.save, this.garageCar, Number(button.dataset.trail));
      this.persistGarage("Trail set.", true);
    });
    this.ui.garageRims?.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-rim]");
      if (!button) return;
      this.save = paintRim(this.save, this.garageCar, Number(button.dataset.rim));
      this.persistGarage("Rims set.", true);
    });
    this.ui.garageGlows?.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-glow]");
      if (!button) return;
      this.save = paintGlow(this.save, this.garageCar, Number(button.dataset.glow));
      this.persistGarage("Glow set.", true);
    });
    this.ui.carNumber?.addEventListener("input", () => {
      const input = this.ui.carNumber as HTMLInputElement;
      this.save = setCarNumber(this.save, this.garageCar, Number(input.value));
      writeSave(this.save);
      this.applyCar(this.save.selectedCar);
    });
    this.ui.resultDouble?.addEventListener("click", () => this.claimDouble());
    const onPaint = () => {
      if (!ownsCar(this.save, this.garageCar) || this.buying) return;
      const primary = parseHex((this.ui.paintPrimary as HTMLInputElement).value);
      const secondary = parseHex((this.ui.paintSecondary as HTMLInputElement).value);
      const accent = parseHex((this.ui.paintAccent as HTMLInputElement).value);
      this.save = paintCar(this.save, this.garageCar, primary, secondary, accent);
      writeSave(this.save);
      if (this.paintTimer !== null) window.clearTimeout(this.paintTimer);
      this.paintTimer = window.setTimeout(() => {
        this.paintTimer = null;
        this.renderGarage();
        this.renderTitle();
      }, 60);
    };
    this.ui.paintPrimary?.addEventListener("input", onPaint);
    this.ui.paintSecondary?.addEventListener("input", onPaint);
    this.ui.paintAccent?.addEventListener("input", onPaint);

    const sfx = this.ui.sfx as HTMLInputElement;
    const music = this.ui.music as HTMLInputElement;
    const motion = this.ui.motion as HTMLInputElement;
    const haptics = this.ui.haptics as HTMLInputElement;
    const hudSpeed = this.ui.hudSpeed;
    const syncHudSide = (side: "left" | "right") => {
      hudSpeed.dataset.side = side;
      hudSpeed.querySelectorAll<HTMLButtonElement>("button[data-side]").forEach((btn) => {
        btn.classList.toggle("is-on", btn.dataset.side === side);
      });
    };
    const hudSkin = this.ui.hudSkin;
    const syncHudSkin = (skin: HudSkin) => {
      hudSkin.dataset.skin = skin;
      hudSkin.querySelectorAll<HTMLButtonElement>("button[data-skin]").forEach((btn) => {
        btn.classList.toggle("is-on", btn.dataset.skin === skin);
      });
    };
    sfx.value = String(this.save.sfxVolume);
    music.value = String(this.save.musicVolume);
    motion.checked = this.save.reducedMotion;
    haptics.checked = this.save.haptics;
    syncHudSide(this.save.hudSpeedSide);
    syncHudSkin(this.save.hudSkin);
    this.ui.hud.dataset.speed = this.save.hudSpeedSide;
    this.ui.hud.dataset.skin = this.save.hudSkin;
    const persist = () => {
      this.save.sfxVolume = Number(sfx.value);
      this.save.musicVolume = Number(music.value);
      this.save.reducedMotion = motion.checked;
      this.save.haptics = haptics.checked;
      this.save.hudSpeedSide = hudSpeed.dataset.side === "right" ? "right" : "left";
      this.save.hudSkin = HUD_SKINS.includes(hudSkin.dataset.skin as HudSkin)
        ? (hudSkin.dataset.skin as HudSkin)
        : "classic";
      this.ui.hud.dataset.speed = this.save.hudSpeedSide;
      this.ui.hud.dataset.skin = this.save.hudSkin;
      this.audio.setVolumes(this.save.sfxVolume, this.save.musicVolume);
      writeSave(this.save);
    };
    sfx.addEventListener("input", persist);
    music.addEventListener("input", persist);
    motion.addEventListener("change", persist);
    haptics.addEventListener("change", persist);
    hudSpeed.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-side]");
      if (!btn?.dataset.side) return;
      syncHudSide(btn.dataset.side === "right" ? "right" : "left");
      persist();
    });
    hudSkin.addEventListener("click", (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-skin]");
      if (!btn?.dataset.skin) return;
      syncHudSkin(btn.dataset.skin as HudSkin);
      persist();
    });
    this.audio.setVolumes(this.save.sfxVolume, this.save.musicVolume);

    this.ui.brakeBtn.addEventListener("pointerdown", () => this.input.setBrakeButton(true));
    window.addEventListener("pointerup", () => this.input.setBrakeButton(false));
    this.ui.boostBtn.addEventListener("pointerdown", (event) => {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      this.input.setBoostButton(true);
    });
    this.ui.boostBtn.addEventListener("pointerup", () => this.input.setBoostButton(false));
    this.ui.boostBtn.addEventListener("pointercancel", () => this.input.setBoostButton(false));
  }

  private claimDouble() {
    if (!this.lastGrant || this.adTimer !== null) return;
    if (!canDoubleReward(this.lastGrant)) return;
    this.playPlacement("rewarded", () => {
      if (!this.lastGrant) return;
      const result = applyDoubleReward(this.save, this.lastGrant);
      this.save = result.save;
      this.lastGrant = result.grant;
      if (result.ok) {
        this.lastCredits *= 2;
        this.save.lastRewardRunId = result.grant.runId;
        writeSave(this.save);
        this.audio.playCoin();
      }
      this.renderResults();
      this.renderTitle();
    });
  }

  private queueBreak() {
    this.pendingBreak = shouldShowInterstitial(this.save.crashCount);
  }

  private consumeBreak(next: "run" | "title"): boolean {
    if (!this.pendingBreak || this.adTimer !== null) return false;
    this.pendingBreak = false;
    this.playPlacement("break", () => {
      if (next === "run") this.startRun();
      else this.toTitle();
    });
    return true;
  }

  private playPlacement(kind: "rewarded" | "break", onDone: () => void) {
    if (this.adTimer !== null) return;
    const overlay = this.ui.interstitial;
    const status = this.ui.adStatus;
    const bar = this.ui.adBar;
    overlay.classList.remove("hidden");
    this.setAdChrome(true);
    if (this.ui.adCircuit) this.ui.adCircuit.textContent = worldById(this.save.selectedWorld).name;
    if (status) status.textContent = kind === "rewarded" ? "Doubling this payout…" : "Stand by…";
    if (bar) {
      bar.style.animation = "none";
      void bar.offsetWidth;
      bar.style.animation = "";
    }
    const ms = kind === "rewarded" ? ADS.rewardedMs : ADS.interstitialMs;
    this.adTimer = window.setTimeout(() => {
      this.adTimer = null;
      overlay.classList.add("hidden");
      this.setAdChrome(false);
      onDone();
    }, ms);
  }

  private setAdChrome(active: boolean) {
    this.ui.shell.toggleAttribute("inert", active);
    this.ui.stage.toggleAttribute("inert", active);
    this.ui.shell.setAttribute("aria-hidden", String(active));
    this.ui.stage.setAttribute("aria-hidden", String(active));
    if (active) {
      this.adReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.ui.interstitial.tabIndex = -1;
      this.ui.interstitial.focus();
    } else {
      this.adReturnFocus?.focus();
      this.adReturnFocus = null;
    }
  }

  private burstCrash() {
    this.shake = Math.max(this.shake, 0.18);
    this.pushToast("CONTACT", "#ff8a9a");
  }

  private toTitle() {
    if (this.consumeBreak("title")) return;
    this.mode = "title";
    this.audio.stopEngine();
    this.setVisible("results", false);
    this.setVisible("pause", false);
    this.setVisible("settings", false);
    this.setVisible("hud", false);
    this.setVisible("touch", false);
    this.setVisible("countdown", false);
    this.setVisible("garage", false);
    this.setPlayingLayout(false);
    this.showRailPanel("title");
    this.player = { x: 0, z: 0, vx: 0, speed: 0, yaw: 0 };
    this.resetFeel();
    this.world.update(0, 0);
    this.sync(0.016);
  }

  private showRailPanel(id: "title" | "garage" | "results" | "settings") {
    if (id !== "settings") this.railReturn = id;
    this.ui.app.dataset.panel = id;
    this.setVisible("title", id === "title");
    this.setVisible("garage", id === "garage");
    this.setVisible("results", id === "results");
    this.setVisible("settings", id === "settings");
    const topTabs: [HTMLElement, boolean][] = [
      [this.ui.navHome, id === "title"],
      [this.ui.openGarage, id === "garage"],
      [this.ui.openSettings, id === "settings"],
    ];
    topTabs.forEach(([el, on]) => {
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-selected", String(on));
      el.tabIndex = on ? 0 : -1;
    });
    if (id === "results") this.ui.navHome.tabIndex = 0;
    const dist = this.mode === "results" ? this.run.distance : 0;
    if (this.ui.stageLabel) this.ui.stageLabel.textContent = zoneAt(dist, this.world.circuit).name;
    if (this.ui.stageMode) {
      this.ui.stageMode.textContent =
        id === "results" ? "Debrief" : id === "garage" ? "Pit" : id === "settings" ? "Box" : "Grid";
    }
  }

  private setPlayingLayout(playing: boolean) {
    this.ui.app.classList.toggle("is-playing", playing);
    this.resize();
    requestAnimationFrame(() => this.resize());
  }

  private setVisible(id: string, visible: boolean) {
    this.ui[id]?.classList.toggle("hidden", !visible);
  }

  private bindTopTabs() {
    const list = this.ui.navHome.parentElement;
    if (!list) return;
    const tabs = [this.ui.navHome, this.ui.openGarage, this.ui.openSettings];
    list.addEventListener("keydown", (event) => {
      const key = event.key;
      if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return;
      const current = tabs.indexOf(event.target as HTMLElement);
      if (current < 0) return;
      event.preventDefault();
      const next =
        key === "Home"
          ? 0
          : key === "End"
            ? tabs.length - 1
            : (current + (key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    });
  }

  private bindSubtabs(root: HTMLElement) {
    const list = root.querySelector<HTMLElement>(":scope > .subtabs");
    if (!list) return;
    const tabs = [...list.querySelectorAll<HTMLButtonElement>("[role='tab']")];
    const panes = [...root.querySelectorAll<HTMLElement>(":scope > .tab-pane")];
    const activate = (id: string) => {
      tabs.forEach((tab) => {
        const on = tab.dataset.subtab === id;
        tab.classList.toggle("is-active", on);
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
      });
      panes.forEach((pane) => {
        const show = pane.dataset.pane === id;
        pane.classList.toggle("is-active", show);
        pane.hidden = !show;
      });
    };
    list.addEventListener("click", (event) => {
      const tab = (event.target as HTMLElement).closest<HTMLButtonElement>("[role='tab']");
      if (!tab?.dataset.subtab || !list.contains(tab)) return;
      activate(tab.dataset.subtab);
    });
    list.addEventListener("keydown", (event) => {
      const key = event.key;
      if (key !== "ArrowRight" && key !== "ArrowLeft" && key !== "Home" && key !== "End") return;
      const current = tabs.indexOf(event.target as HTMLButtonElement);
      if (current < 0) return;
      event.preventDefault();
      const next =
        key === "Home"
          ? 0
          : key === "End"
            ? tabs.length - 1
            : (current + (key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
      const tab = tabs[next];
      const id = tab.dataset.subtab;
      if (!id) return;
      tab.focus();
      activate(id);
    });
  }

  private touchy() {
    return matchMedia("(pointer: coarse)").matches;
  }

  private resize = () => {
    const box = this.ui.viewport ?? this.ui.stage;
    const w = Math.max(1, box?.clientWidth || innerWidth);
    const h = Math.max(1, box?.clientHeight || innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onVisibility = () => {
    this.hidden = document.hidden;
    if (this.hidden && this.mode === "playing") this.setPause(true);
    this.clock.getDelta();
  };
}
