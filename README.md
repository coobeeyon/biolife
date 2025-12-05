# Biolife

A 2D artificial life simulation where soft-bodied creatures made of nodes and links swim in a viscous fluid, evolving through natural selection.

## Quick Start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Overview

Creatures are built from:
- **Nodes** - circular segments with different types (colors)
- **Links** - springs connecting nodes, some with actuation (muscles)

Node types:
- **Green (Solar)** - generates energy from sunlight
- **Red (Sucker)** - drains energy from other creatures
- **Gray (Neutral)** - cheap structural nodes
- **Magenta (Mating)** - triggers sexual reproduction on contact

Creatures swim using anisotropic drag physics - links act as paddles that push harder broadside than lengthwise. Actuated links oscillate their rest length, creating swimming motion.

## Key Features

- **Toroidal world** - edges wrap around
- **Asexual reproduction** - creatures divide when energy exceeds threshold (150)
- **Sexual reproduction** - mating nodes trigger crossover between genomes
- **Mutation** - offspring have mutated genomes
- **Energy economy** - different node types have different maintenance costs

## Project Structure

```
src/
  types.ts      - Type definitions
  genome.ts     - Genome generation and mutation
  creature.ts   - Creature instantiation from genome
  physics.ts    - Spring forces, drag, toroidal wrapping
  collision.ts  - Collision detection and interactions
  simulation.ts - Main simulation loop, energy, reproduction
  renderer.ts   - Three.js rendering
  main.ts       - Entry point and configuration
```

## Configuration

Key parameters in `main.ts`:
- `WORLD_WIDTH/HEIGHT` - World size (currently 2400x1800)
- `viscosity` - Drag coefficient
- `insolation` - Solar energy rate
- `divisionEnergyThreshold` - Energy needed to divide (150)

## Build

```bash
npm run build
npm run preview
```
