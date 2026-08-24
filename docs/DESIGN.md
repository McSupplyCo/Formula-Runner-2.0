# Formula Runner 2.0 Design

**Direction:** Midnight Voltage  
**Tech:** Vite + TypeScript + Three.js  
**Tagline:** Floor it. Don't stop.

## Fantasy

Drive an original formula car through a night circuit of traffic. Speed is the high. Gaps are the puzzle.

## Loop

Title → Race → countdown → auto-accelerate and steer → near-miss / overtake / boost → crash → Race again.

## Pillars

1. Instant arcade control
2. High-speed risk and reward
3. Clean modern motorsport presentation
4. Short, replayable runs
5. Fair difficulty
6. Original F1-inspired identity

## Essential

Auto-accel, analog steer, optional brake, authored traffic with gaps, speed-scaled look-ahead, near-miss combo, overtake score, boost, three original cars, pause, settings, versioned save.

## Architecture

Unity 1.0 stays in `Assets/`. 2.0 is a Vite + TypeScript + Three.js web game so it can be played and verified without the Unity Editor.

## Playtest (2026-08-24)

Headless Chrome 1440×900: 60fps, 512 m run, score ~1979, 2 near misses, 2 overtakes, combo ×2. Walls clamp; traffic collisions end the run. Pause works. Linear issue creation is blocked by the workspace free-issue cap; the project + milestones + this design doc are the tracker.

## Deferred

Ads, 100-level upgrades, daily challenges, IAP, multiplayer, realistic physics, licensed brands, curved spline circuits.
