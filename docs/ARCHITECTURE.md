# Architecture

## Module Overview

```
main.ts          Entry point, game loop, configuration
    |
    v
simulation.ts    High-level simulation step
    |
    +---> physics.ts      Forces, drag, integration
    +---> collision.ts    Collision detection & response
    +---> creature.ts     Creature instantiation
    +---> genome.ts       Genome mutation & crossover
    |
    v
renderer.ts      Three.js visualization
```

## Data Flow

### Per-Frame Update

```
1. step(world, collisionSystem, dt)
   |
   +-- Spawn food (random chance)
   +-- applySolarEnergy() - green nodes generate
   +-- updatePhysics() - forces, drag, integration
   +-- collisionSystem.sync() - update collision bodies
   +-- processCollisions() - handle overlaps
   +-- processMating() - sexual reproduction
   +-- Age creatures, apply maintenance costs
   +-- processDivision() - asexual reproduction
   +-- processDeaths() - remove dead, spawn food

2. renderer.sync(world) - update visual meshes
3. renderer.render() - draw frame
```

## Key Data Structures

### World
```typescript
interface World {
  config: WorldConfig;
  creatures: Creature[];
  food: Food[];
  tick: number;
  nextCreatureId: number;
  nextFoodId: number;
}
```

### Creature
```typescript
interface Creature {
  id: number;
  nodes: Node[];        // Runtime state
  links: Link[];        // Springs between nodes
  genome: Genome;       // Genetic blueprint
  energy: number;
  age: number;
  alive: boolean;
}
```

### Genome
```typescript
type Genome = NodeGene[];

interface NodeGene {
  type: SegmentType;    // neutral, solar, sucker, mating
  size: number;
  links: number[];      // Relative indices (+1, -2, etc)
  efficiency?: number;  // For suckers
}
```

## Collision System

Uses `detect-collisions` library for broad-phase collision detection.

### Sync Process
1. Create/update Circle bodies for each node
2. Create/update Circle bodies for each food
3. Remove stale bodies

### Collision Response
- **Node vs Food**: Sucker drains food energy
- **Node vs Node** (different creatures):
  - Sucker drains other creature
  - Mating nodes trigger reproduction
  - Physical separation (push apart)

### Limitation
Collision detection doesn't wrap around world edges. Creatures can't interact across boundaries.

## Renderer

Uses Three.js with orthographic camera for 2D view.

### Object Pooling
- Meshes are cached by key (creature_id + node/link index)
- Stale meshes removed when creatures die
- Geometries shared across similar objects

### Toroidal Rendering
Links use `toroidalDelta()` to draw via shortest path, so links crossing boundaries render correctly.

## Genome System

### Generation
Random genomes have 3-8 nodes with random types, sizes, and connectivity.

### Mutation
- Size: Gaussian perturbation
- Type: Small chance to change
- Links: Add/remove connections
- Efficiency: Gaussian perturbation

### Crossover
Interleaves genes from both parents with random cut points.

## Configuration

Key tuning parameters in `main.ts`:

```typescript
const world = createWorld({
  width: 2400,
  height: 1800,
  viscosity: 0.08,
  insolation: 0.0015,
  foodSpawnRate: 0.02,
  foodEnergy: 15,
  matingEnergyCost: 80,
  matingEnergyThreshold: 50,
  divisionEnergyThreshold: 150,
  mutationRate: 0.1,
  mutationStrength: 0.2,
});
```
