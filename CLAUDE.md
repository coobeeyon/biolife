# Claude Code Context

This file provides context for continuing development with Claude Code.

## Project Summary

2D artificial life simulation with soft-bodied creatures swimming in viscous fluid. Creatures evolve through natural selection - those that gather more energy reproduce more.

## Current State

Working simulation with:
- Anisotropic drag physics (swimming works)
- Toroidal world (no edge issues)
- Balanced energy economy
- Asexual division at energy threshold
- Sexual reproduction via mating nodes (currently weak/unused)

## Recent Changes

1. **Toroidal world** - Creatures wrap around edges instead of bouncing. All physics (links, drag, self-collision) uses toroidal distances.

2. **Energy balance by node type**:
   - Solar (green): 1x maintenance cost, generates `area * insolation` per tick
   - Sucker (red): 4x maintenance cost, drains 6x rate with 80% efficiency
   - Neutral (gray): 0.25x cost
   - Mating (magenta): 0.25x cost

3. **World scaled 3x** - Now 2400x1800

## Known Issues / TODO

1. **Mating nodes underperform** - With asexual division available, mating offers little advantage. Options discussed:
   - Remove mating entirely
   - Make mating more efficient (lower threshold, more child energy)
   - Replace with defense/spike node

2. **Cross-boundary collisions** - The detect-collisions library doesn't know about wrapping. Creatures can't collide across boundaries. Would need ghost body copies to fix.

## Physics Model

Links are treated as rigid paddles:
- **Anisotropic drag**: perpendicular motion has high drag, parallel has 10%
- **Rotational drag**: resists spinning
- **Spring damping**: 0.5x critical damping to reduce jiggle

Swimming works via scallop theorem - need 2+ degrees of freedom tracing a loop in configuration space. Random actuation phases create this naturally.

## Key Files

- `physics.ts` - Core physics, `toroidalDelta()` and `wrapPosition()` exported for other modules
- `simulation.ts` - Energy economy, reproduction, main step loop
- `creature.ts` - 20% of links have actuation
- `collision.ts` - Sucker drain at lines 176-195

## Energy Numbers

With default params:
- Solar node (size 10): generates ~100 * 0.0015 = 0.15 energy/tick
- Same node costs: 100 * 0.001 * 1.0 = 0.1 energy/tick (net +0.05)
- Sucker node (size 10): costs 100 * 0.001 * 4.0 = 0.4 energy/tick
- Sucker drain: ~0.5 * 3.0 = 1.5 energy/tick from victim, gains 1.2

## Running

```bash
npm run dev    # Development server at localhost:5173
npm run build  # Production build
```
