# Formula Runner 2.0

Arcade night-circuit racer. Floor it. Don't stop.

This repository is the second generation of Formula Runner: a focused, instantly playable web game. The Unity 1.0 prototype lives in [McSupplyCo/Formula-Runner](https://github.com/McSupplyCo/Formula-Runner).

## Play

```bash
npm install
npm run dev
```

Open the local URL, then click **Race**.

| Input | Action |
|---|---|
| A / D or arrows | Steer |
| S / Down | Brake |
| Space or Shift | Boost |
| Esc / P | Pause |
| Drag | Steer on pointer / touch |

## Design

- Auto-accelerate. Steering is independent of throttle.
- Score from distance, speed, near misses, and overtakes.
- Boost charges from near misses.
- Three original cars: Apex, Drift, Surge.
- No licensed F1 teams, tracks, or audio.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

## Linear

Project: [Formula Runner 2.0](https://linear.app/mcsupplyco/project/formula-runner-20-83a9cb34c286)
