# Physics Model

## Overview

Creatures are soft bodies made of nodes (point masses) connected by links (springs). They swim in a viscous fluid using anisotropic drag.

## Coordinate System

- Origin at center of world
- X increases right, Y increases up
- Toroidal topology - edges wrap around

## Node Physics

Each node has:
- Position (x, y)
- Velocity (vx, vy)
- Mass proportional to area: `mass = size^2`

Nodes experience isotropic drag:
```
dragCoeff = size * viscosity
v *= 1 / (1 + dragCoeff)
```

## Link Physics

Links are springs with optional actuation.

### Spring Forces

```
displacement = currentLength - targetLength
force = stiffness * displacement
```

Target length oscillates if actuated:
```
targetLength = restLength * (1 + actuationAmp * sin(tick * freq + phase))
```

### Spring Damping

Uses 0.5x critical damping to reduce oscillation without over-damping:
```
reducedMass = (massA * massB) / (massA + massB)
criticalDamping = 2 * sqrt(stiffness * reducedMass)
dampingForce = relativeVelocity * criticalDamping * 0.5
```

### Anisotropic Drag (Swimming)

Links act as rigid paddles. Drag depends on motion direction relative to link orientation:

- **Perpendicular (broadside)**: High drag - `length * viscosity`
- **Parallel (lengthwise)**: Low drag - `length * viscosity * 0.1`

This creates thrust: when a link pushes broadside against fluid, it moves the creature.

### Rotational Drag

Links resist rotation:
```
omega = (vPerpB - vPerpA) / length  // Angular velocity
torque = -(1/12) * length^3 * viscosity * omega
```

The 1/12 factor comes from moment of inertia of a uniform rod.

## Swimming Mechanics

### Scallop Theorem

In viscous fluid (low Reynolds number), reciprocal motion produces no net displacement. A scallop opening and closing just oscillates in place.

To swim, creatures need motion that traces a loop in configuration space - at least 2 degrees of freedom changing out of phase.

### How It Works Here

Random actuation phases on different links naturally create configuration loops. Some links contract while others expand, creating asymmetric paddle strokes that produce net thrust.

## Toroidal Wrapping

All distance calculations use shortest path on torus:
```typescript
function toroidalDelta(x1, y1, x2, y2, width, height) {
  let dx = x2 - x1;
  let dy = y2 - y1;

  if (dx > width/2) dx -= width;
  else if (dx < -width/2) dx += width;

  if (dy > height/2) dy -= height;
  else if (dy < -height/2) dy += height;

  return { dx, dy };
}
```

This affects:
- Link forces (springs work across boundaries)
- Link drag (paddles work across boundaries)
- Self-collision (nodes don't overlap across boundaries)
- Rendering (links draw via shortest path)

## Self-Collision

Nodes of the same creature can't overlap. When they do, they're pushed apart proportionally to mass:
```
overlap = minDist - dist
nodeA moves: overlap * (massB / totalMass)
nodeB moves: overlap * (massA / totalMass)
```

## Integration

Simple Euler integration:
```
x += vx * dt
y += vy * dt
```

After integration, positions are wrapped to stay in world bounds.
