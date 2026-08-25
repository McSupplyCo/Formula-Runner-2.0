import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GameAudio } from "./audio";
import { hits, nearMissClearance } from "./collision";
import { InputController } from "./input";
import { clamp, damp, formatDistance, formatScore, laneCenter } from "./math";
import { materializePattern, pickPattern, type TrafficCar } from "./patterns";
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
import { BLOOM, CAMERA, CARS, CHASSIS, DRIVE, ROAD, SPAWN, type CarId } from "./tuning";
import { createFormulaCar, createTrafficCar } from "./vehicles";
import { TrackWorld, zoneAt } from "./world";
import { makeNightEnv } from "./env";

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
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
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
    this.renderer.toneMappingExposure = BLOOM.exposure;
    this.scene.environment = makeNightEnv(this.renderer);
    this.scene.environmentIntensity = 0.85;

    this.world = new TrackWorld(this.scene);
    this.playerMesh = createFormulaCar(CARS[0].color, CARS[0].accent);
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
    this.setupBloom();

    this.input.attach(canvas);
    this.bindUi();
    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.renderTitle();
    this.resetFeel();
    this.world.update(0, 0);
    this.sync(0.016);
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
    this.countdown = 2.95;
    this.crashTimer = 0;
    this.shake = 0;
    this.lastBest = false;
    this.resetFeel();
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
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  };

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
    this.player.yaw = damp(this.player.yaw, steer * DRIVE.visualYaw, 10, dt);
    this.run.speed = this.player.speed;
    this.updateChassis(dt, steer, brake);
    this.prevSpeed = this.player.speed;
    if (!scoring) return;

    const combo = tickCombo(this.run.combo, this.run.comboTimer, dt);
    this.run.combo = combo.combo;
    this.run.comboTimer = combo.timer;
    const dz = (this.player.speed / 3.6) * dt;
    this.run.distance += dz;
    this.run.score += distanceScore(dz, this.player.speed, car.topSpeed);
  }

  private updateChassis(dt: number, steer: number, brake: number) {
    const motion = this.save.reducedMotion ? 0.28 : 1;
    const accel = (this.player.speed - this.prevSpeed) / Math.max(dt, 1 / 120);
    const pitchAccel = clamp(-accel * CHASSIS.pitchAccel, -CHASSIS.pitchMax, CHASSIS.pitchMax);
    const pitchBrake = brake > 0.2 ? CHASSIS.pitchBrake : 0;
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
    if (this.mode !== "playing" || this.run.boosting || this.run.boost < DRIVE.boostMinCharge) return;
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
    this.shake = 0.14;
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
    this.playerMesh.position.set(this.player.x, this.chassis.y, this.player.z);
    this.playerMesh.rotation.set(
      this.chassis.pitch,
      THREE.MathUtils.degToRad(-this.player.yaw),
      this.chassis.roll,
    );
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
    this.updateHud();
  }

  private spinWheels(root: THREE.Object3D, speedKph: number, dt: number) {
    const v = speedKph / 3.6;
    root.traverse((obj) => {
      if (obj.userData.spin) {
        const radius = Number(obj.userData.radius) || 0.32;
        obj.rotation.x += (v / radius) * dt;
      }
      if (obj.userData.ground) {
        const base = Number(obj.userData.baseScaleY) || 2;
        (obj as THREE.Mesh).scale.y = base * (1 + speedKph / 480);
      }
    });
  }

  private updateCamera(dt: number) {
    const reduced = this.save.reducedMotion;
    const speedT = clamp(this.player.speed / 260, 0, 1);
    const punchHold = this.run.boosting && !reduced ? 0.38 : 0;
    this.boostPunch = damp(this.boostPunch, punchHold, 7.5, dt);
    this.fovKick = Math.max(0, this.fovKick - dt * 14);
    this.land = Math.max(0, this.land - dt * 3.6);
    const punch = reduced ? 0 : this.boostPunch;
    const land = reduced ? 0 : this.land;
    const extra = this.run.boosting && !reduced ? CAMERA.fovBoostExtra : 0;
    const targetFov =
      CAMERA.fovIdle + (CAMERA.fovFast - CAMERA.fovIdle) * speedT + extra + (reduced ? 0 : this.fovKick);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6.2, dt);
    this.camera.updateProjectionMatrix();

    this.desiredCam.set(
      this.player.x * 0.26,
      CAMERA.height + speedT * 0.1 + this.chassis.y * 0.42 - punch * 0.16 - land * CAMERA.landDrop,
      this.player.z - CAMERA.back - speedT * 1.05 - punch * CAMERA.boostPunch,
    );
    this.camPos.x = damp(this.camPos.x, this.desiredCam.x, CAMERA.lag, dt);
    this.camPos.y = damp(this.camPos.y, this.desiredCam.y, CAMERA.follow, dt);
    this.camPos.z = damp(this.camPos.z, this.desiredCam.z, CAMERA.follow * 1.2, dt);

    if (!reduced && this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.4);
      const t = this.clock.elapsedTime;
      const hit = this.shake * CAMERA.shakeMax * 4;
      this.camPos.x += Math.sin(t * 9.4) * hit;
      this.camPos.y += Math.cos(t * 7.1) * hit * 0.35;
    }

    this.look.set(
      this.player.x * 0.16 + this.chassis.roll * 1.4,
      CAMERA.lookHeight + speedT * 0.06 - land * 0.18,
      this.player.z + CAMERA.lookAhead + speedT * 2.2 + punch * 1.4,
    );
    this.lookMat.lookAt(this.camPos, this.look, this.camera.up);
    this.camQuat.setFromRotationMatrix(this.lookMat);
    const rollTarget = reduced ? 0 : this.chassis.roll * 0.55 + this.player.vx * CAMERA.steerRoll;
    this.camRoll = damp(this.camRoll, rollTarget, 10, dt);
    this.camera.position.copy(this.camPos);
    this.camera.quaternion.copy(this.camQuat);
    this.camera.rotateZ(this.camRoll);
  }

  private updateBoostFx(dt: number) {
    const live = this.run.boosting && this.mode === "playing" && !this.save.reducedMotion;
    const trailMat = this.boostTrail.material as THREE.LineBasicMaterial;
    const glowMat = this.boostGlow.material as THREE.MeshBasicMaterial;
    trailMat.opacity = damp(trailMat.opacity, live ? 0.55 : 0, 10, dt);
    glowMat.opacity = damp(glowMat.opacity, live ? 0.28 : 0, 9, dt);
    this.boostLight.intensity = damp(this.boostLight.intensity, live ? 1.35 : 0, 8, dt);

    this.trailTip.set(this.player.x, 0.32 + this.chassis.y, this.player.z - 1.35);
    if (this.trailHistory.length === 0 || this.trailHistory[0].distanceToSquared(this.trailTip) > 0.04) {
      const slot = this.trailHistory.length < 22 ? new THREE.Vector3() : this.trailHistory.pop()!;
      slot.copy(this.trailTip);
      this.trailHistory.unshift(slot);
    } else {
      this.trailHistory[0].copy(this.trailTip);
    }
    const pos = this.boostTrail.geometry.getAttribute("position");
    for (let i = 0; i < pos.count; i++) {
      const src = this.trailHistory[Math.min(i, Math.max(0, this.trailHistory.length - 1))] ?? this.trailTip;
      pos.setXYZ(i, src.x, src.y, src.z);
    }
    pos.needsUpdate = true;
    this.boostTrail.geometry.computeBoundingSphere();
    this.boostTrail.visible = trailMat.opacity > 0.02;
    this.boostGlow.visible = glowMat.opacity > 0.02;
    this.boostGlow.position.set(this.player.x, 0.36 + this.chassis.y, this.player.z - 2.05);
    this.boostGlow.scale.set(live ? 0.85 : 0.5, live ? 0.85 : 0.5, 1 + this.boostPunch * 0.55);
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
    this.camPos.set(this.player.x * 0.26, CAMERA.height, this.player.z - CAMERA.back);
    this.camera.fov = CAMERA.fovIdle;
    this.camera.updateProjectionMatrix();
    (this.boostTrail.material as THREE.LineBasicMaterial).opacity = 0;
    (this.boostGlow.material as THREE.MeshBasicMaterial).opacity = 0;
    this.boostLight.intensity = 0;
    this.boostTrail.visible = false;
    this.boostGlow.visible = false;
    this.spray.visible = false;
    (this.spray.material as THREE.PointsMaterial).opacity = 0;
  }

  private setupBloom() {
    try {
      const composer = new EffectComposer(this.renderer);
      composer.addPass(new RenderPass(this.scene, this.camera));
      const bloom = new UnrealBloomPass(
        new THREE.Vector2(1, 1),
        BLOOM.strength,
        BLOOM.radius,
        BLOOM.threshold,
      );
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
      this.composer = composer;
      this.bloomPass = bloom;
    } catch {
      this.composer = null;
      this.bloomPass = null;
    }
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
    const count = 42;
    const array = new Float32Array(count * 3);
    const streaks = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      streaks[i * 3] = (Math.random() - 0.5) * 8;
      streaks[i * 3 + 1] = 0.4 + Math.random() * 2;
      streaks[i * 3 + 2] = -12 + Math.random() * 40;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(array, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xe8eef4,
        size: 0.055,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.userData.streaks = streaks;
    points.visible = false;
    points.frustumCulled = false;
    return points;
  }

  private updateSpeedLines(dt: number) {
    const live = this.run.boosting && this.mode === "playing" && !this.save.reducedMotion;
    const mat = this.speedLines.material as THREE.PointsMaterial;
    mat.opacity = damp(mat.opacity, live ? 0.2 : 0, 8, dt);
    this.speedLines.visible = mat.opacity > 0.02;
    if (!this.speedLines.visible) return;
    const streaks = this.speedLines.userData.streaks as Float32Array;
    const pos = this.speedLines.geometry.getAttribute("position");
    const vz = this.player.speed / 3.6;
    for (let i = 0; i < pos.count; i++) {
      streaks[i * 3 + 2] -= vz * dt * 1.6;
      if (streaks[i * 3 + 2] < -14) {
        streaks[i * 3] = (Math.random() - 0.5) * 7;
        streaks[i * 3 + 1] = 0.35 + Math.random() * 1.8;
        streaks[i * 3 + 2] = 10 + Math.random() * 18;
      }
      pos.setXYZ(
        i,
        this.player.x + streaks[i * 3],
        0.45 + this.chassis.y + streaks[i * 3 + 1],
        this.player.z + streaks[i * 3 + 2],
      );
    }
    pos.needsUpdate = true;
  }

  private makeSpray() {
    const count = 88;
    this.sprayLife = new Float32Array(count);
    const array = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.sprayLife[i] = Math.random();
      array[i * 3] = 0;
      array[i * 3 + 1] = 0.08;
      array[i * 3 + 2] = 0;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(array, 3));
    const points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xc8ccd0,
        size: 0.05,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    );
    points.visible = false;
    points.frustumCulled = false;
    return points;
  }

  private updateSpray(dt: number) {
    const on = this.mode === "playing" && this.player.speed > 88 && !this.save.reducedMotion;
    const mat = this.spray.material as THREE.PointsMaterial;
    mat.opacity = damp(mat.opacity, on ? 0.32 : 0, 7, dt);
    this.spray.visible = mat.opacity > 0.02;
    if (!this.spray.visible) return;
    const pos = this.spray.geometry.getAttribute("position");
    const drift = (this.player.speed / 3.6) * dt;
    for (let i = 0; i < pos.count; i++) {
      this.sprayLife[i] += dt * (1.6 + this.player.speed / 160);
      if (this.sprayLife[i] >= 1) {
        this.sprayLife[i] = 0;
        const side = i % 2 === 0 ? -0.84 : 0.84;
        pos.setXYZ(
          i,
          this.player.x + side + (Math.random() - 0.5) * 0.16,
          0.06 + Math.random() * 0.05,
          this.player.z - 1.05 - Math.random() * 0.35,
        );
      } else {
        pos.setXYZ(
          i,
          pos.getX(i) + (Math.random() - 0.5) * 0.03,
          pos.getY(i) + dt * 0.42,
          pos.getZ(i) - drift * 0.35,
        );
      }
    }
    pos.needsUpdate = true;
  }

  private makeBoostTrail() {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(22 * 3), 3));
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xffe0b8,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    line.visible = false;
    line.frustumCulled = false;
    return line;
  }

  private makeBoostGlow() {
    const geo = new THREE.ConeGeometry(0.1, 1.45, 8, 1, true);
    geo.rotateX(-Math.PI / 2);
    const glow = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: 0xffd8a0,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    glow.visible = false;
    glow.frustumCulled = false;
    return glow;
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
    if (this.ui.gear) this.ui.gear.textContent = this.gearLabel(this.run.speed);
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

  private gearLabel(speed: number) {
    if (speed < 70) return "2";
    if (speed < 120) return "3";
    if (speed < 165) return "4";
    if (speed < 210) return "5";
    if (speed < 250) return "6";
    return "7";
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
    this.resetFeel();
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
    const w = innerWidth;
    const h = Math.max(1, innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.bloomPass?.setSize(w, h);
  };

  private onVisibility = () => {
    this.hidden = document.hidden;
    if (this.hidden && this.mode === "playing") this.setPause(true);
    this.clock.getDelta();
  };
}
