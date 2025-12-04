import { World, WorldConfig, Creature, Food, SegmentType } from './types';
import { createCreature, getCreatureCenter, getCreatureMass } from './creature';
import { randomGenome, crossover, mutate } from './genome';
import { updatePhysics } from './physics';
import { CollisionSystem, processCollisions } from './collision';

const DEFAULT_CONFIG: WorldConfig = {
  width: 800,
  height: 600,
  viscosity: 0.1,
  insolation: 0.05,
  foodSpawnRate: 0.1,
  foodEnergy: 20,
  matingEnergyCost: 30,
  matingEnergyThreshold: 50,
  divisionEnergyThreshold: 150,
  mutationRate: 0.1,
  mutationStrength: 0.3,
};

export function createWorld(config: Partial<WorldConfig> = {}): World {
  return {
    config: { ...DEFAULT_CONFIG, ...config },
    creatures: [],
    food: [],
    tick: 0,
    nextCreatureId: 0,
    nextFoodId: 0,
  };
}

// Spawn a new creature with random genome
export function spawnRandomCreature(world: World, x?: number, y?: number, energy: number = 50): Creature {
  const hw = world.config.width / 2;
  const hh = world.config.height / 2;

  const creature = createCreature(
    world.nextCreatureId++,
    randomGenome(),
    x ?? (Math.random() - 0.5) * world.config.width * 0.8,
    y ?? (Math.random() - 0.5) * world.config.height * 0.8,
    energy
  );

  world.creatures.push(creature);
  return creature;
}

// Spawn food at random location
export function spawnFood(world: World, x?: number, y?: number): Food {
  const hw = world.config.width / 2;
  const hh = world.config.height / 2;

  const food: Food = {
    id: world.nextFoodId++,
    x: x ?? (Math.random() - 0.5) * world.config.width * 0.9,
    y: y ?? (Math.random() - 0.5) * world.config.height * 0.9,
    energy: world.config.foodEnergy,
    radius: 3,
  };

  world.food.push(food);
  return food;
}

// Convert dead creature to food
function creatureToFood(world: World, creature: Creature): void {
  const center = getCreatureCenter(creature);
  const mass = getCreatureMass(creature);

  // Create food particles proportional to creature size
  const numParticles = Math.max(1, Math.floor(mass / 50));
  const energyPerParticle = (creature.energy + mass * 0.1) / numParticles;

  for (let i = 0; i < numParticles; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 20;

    world.food.push({
      id: world.nextFoodId++,
      x: center.x + Math.cos(angle) * dist,
      y: center.y + Math.sin(angle) * dist,
      energy: Math.max(5, energyPerParticle),
      radius: 3,
    });
  }
}

// Handle reproduction between two creatures
function reproduce(world: World, parentA: Creature, parentB: Creature): Creature | null {
  // Check energy requirements
  if (
    parentA.energy < world.config.matingEnergyThreshold ||
    parentB.energy < world.config.matingEnergyThreshold
  ) {
    return null;
  }

  console.log(`MATING: ${parentA.id} (${parentA.energy.toFixed(1)}) + ${parentB.id} (${parentB.energy.toFixed(1)}) -> threshold=${world.config.matingEnergyThreshold}`);

  // Deduct energy cost
  parentA.energy -= world.config.matingEnergyCost / 2;
  parentB.energy -= world.config.matingEnergyCost / 2;

  console.log(`  After cost: ${parentA.id} (${parentA.energy.toFixed(1)}), ${parentB.id} (${parentB.energy.toFixed(1)})`);
  console.log(`  Total creatures: ${world.creatures.length}`);

  // Create child genome
  let childGenome = crossover(parentA.genome, parentB.genome);
  childGenome = mutate(childGenome, world.config.mutationRate, world.config.mutationStrength);

  // Ensure child has at least one node
  if (childGenome.length === 0) {
    childGenome = Math.random() < 0.5 ? [...parentA.genome] : [...parentB.genome];
  }

  // Spawn child near parents
  const centerA = getCreatureCenter(parentA);
  const centerB = getCreatureCenter(parentB);
  const childX = (centerA.x + centerB.x) / 2 + (Math.random() - 0.5) * 30;
  const childY = (centerA.y + centerB.y) / 2 + (Math.random() - 0.5) * 30;

  // Child starts at mating threshold (parents pay more than child gets = net energy loss)
  const childEnergy = world.config.matingEnergyThreshold;

  const child = createCreature(world.nextCreatureId++, childGenome, childX, childY, childEnergy);
  world.creatures.push(child);

  return child;
}

// Apply solar energy generation - fixed total energy divided among all solar nodes
function applySolarEnergy(world: World): void {
  // First, count total solar area
  let totalSolarArea = 0;
  for (const creature of world.creatures) {
    if (!creature.alive) continue;
    for (const node of creature.nodes) {
      if (node.gene.type === SegmentType.Solar) {
        totalSolarArea += node.gene.size * node.gene.size; // Area = size^2
      }
    }
  }

  if (totalSolarArea === 0) return;

  // Fixed total solar energy per tick, divided proportionally
  const totalSolarEnergy = world.config.insolation * 100; // Total energy available from sun

  // Distribute to each solar node based on its share of total area
  for (const creature of world.creatures) {
    if (!creature.alive) continue;
    for (const node of creature.nodes) {
      if (node.gene.type === SegmentType.Solar) {
        const nodeArea = node.gene.size * node.gene.size;
        const share = nodeArea / totalSolarArea;
        creature.energy += totalSolarEnergy * share;
      }
    }
  }
}

// Asexual division - creature splits when it has too much energy
function processDivision(world: World): void {
  const newCreatures: Creature[] = [];

  for (const creature of world.creatures) {
    if (!creature.alive) continue;
    if (creature.energy < world.config.divisionEnergyThreshold) continue;

    // Split energy between parent and child (with some loss)
    const totalEnergy = creature.energy;
    const childEnergy = totalEnergy * 0.4; // Child gets 40%
    creature.energy = totalEnergy * 0.4;   // Parent keeps 40% (20% lost to division cost)

    // Child genome is parent's genome with possible mutations
    const childGenome = mutate([...creature.genome], world.config.mutationRate, world.config.mutationStrength);

    // Spawn child near parent
    const center = getCreatureCenter(creature);
    const angle = Math.random() * Math.PI * 2;
    const dist = 30;
    const childX = center.x + Math.cos(angle) * dist;
    const childY = center.y + Math.sin(angle) * dist;

    const child = createCreature(world.nextCreatureId++, childGenome, childX, childY, childEnergy);
    newCreatures.push(child);
  }

  world.creatures.push(...newCreatures);
}

// Process creature death
function processDeaths(world: World): void {
  for (const creature of world.creatures) {
    if (creature.alive && creature.energy <= 0) {
      creature.alive = false;
      creatureToFood(world, creature);
    }
  }

  // Remove dead creatures
  world.creatures = world.creatures.filter(c => c.alive);
}

// Main simulation step
export function step(world: World, collisionSystem: CollisionSystem, dt: number = 1): void {
  world.tick++;

  // Spawn food
  if (Math.random() < world.config.foodSpawnRate) {
    spawnFood(world);
  }

  // Apply solar energy
  applySolarEnergy(world);

  // Update physics
  updatePhysics(world, dt);

  // Update collision detection
  collisionSystem.sync(world);
  const collisions = collisionSystem.getCollisions();
  processCollisions(world, collisions);

  // Process mating
  const pendingMating = (world as any)._pendingMating as [Creature, Creature][] | undefined;
  if (pendingMating) {
    for (const [parentA, parentB] of pendingMating) {
      reproduce(world, parentA, parentB);
    }
    delete (world as any)._pendingMating;
  }

  // Age creatures and process deaths
  for (const creature of world.creatures) {
    creature.age++;
    // Small passive energy drain
    creature.energy -= 0.01;
  }

  // Asexual division for creatures with excess energy
  processDivision(world);

  processDeaths(world);
}

// Initialize world with some starting creatures and food
export function initializeWorld(
  world: World,
  numCreatures: number = 10,
  numFood: number = 50
): void {
  for (let i = 0; i < numCreatures; i++) {
    spawnRandomCreature(world);
  }

  for (let i = 0; i < numFood; i++) {
    spawnFood(world);
  }
}
