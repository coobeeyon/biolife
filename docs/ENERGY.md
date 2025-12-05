# Energy Economy

## Overview

Energy is the currency of survival. Creatures need energy to:
- Stay alive (maintenance costs)
- Move (actuation costs)
- Reproduce (mating/division costs)

## Energy Sources

### Solar (Green Nodes)

Each solar node generates energy proportional to its area:
```
energyGain = nodeArea * insolation
           = size^2 * 0.0015  (with current params)
```

A size-10 solar node generates: `100 * 0.0015 = 0.15` energy/tick

### Feeding (Sucker Nodes)

Red (sucker) nodes drain energy from creatures they touch:
```
drainRate = efficiency * 3.0  // 6x base rate
           = 0.5 * 3.0 = 1.5 energy/tick (typical)

transferEfficiency = 80%
energyGained = drain * 0.8 = 1.2 energy/tick
```

Suckers are ~8x more efficient than solar while in contact, but require finding and catching prey.

### Food Particles

Yellow particles spawn randomly. Suckers can drain them too.

When creatures die, they become food particles proportional to their mass.

## Energy Costs

### Maintenance (Per Node)

Each node costs energy proportional to its area, scaled by type:

| Type | Multiplier | Size-10 Cost/tick |
|------|------------|-------------------|
| Solar (green) | 1.0x | 0.10 |
| Sucker (red) | 4.0x | 0.40 |
| Neutral (gray) | 0.25x | 0.025 |
| Mating (magenta) | 0.25x | 0.025 |

Formula: `cost = area * 0.001 * multiplier`

### Actuation

Moving costs energy proportional to actuation intensity:
```
actuationCost = sum(link.actuationAmp * link.actuationFreq * 0.001)
```

Actuation scales with energy efficiency (reduces when low on energy).

## Energy Balance Examples

### Pure Solar Creature

Size-10 solar node:
- Generates: 0.15/tick
- Costs: 0.10/tick
- Net: +0.05/tick

Can support ~0.5 worth of other costs (small neutral nodes).

### Predator Creature

Size-10 sucker + size-10 solar:
- Solar generates: 0.15/tick
- Sucker costs: 0.40/tick
- Solar costs: 0.10/tick
- Net without prey: -0.35/tick

Must catch prey frequently to survive. When feeding:
- Drain: +1.2/tick
- Net while feeding: +0.85/tick

## Reproduction

### Asexual Division

Triggers when: `energy >= 150`

Energy split:
- Child gets: 40%
- Parent keeps: 40%
- Lost: 20%

Child genome = parent genome + mutations

### Sexual Reproduction (Mating)

Requires both parents have: `energy >= matingEnergyThreshold (50)`

Each parent pays: `matingEnergyCost / 2 (40)`

Child receives: `matingEnergyThreshold (50)`

Child genome = crossover(parentA, parentB) + mutations

## Death

Creatures die when: `energy <= 0`

On death:
- Creature is removed
- Food particles spawn at location
- Food energy = creature.energy + mass * 0.1
