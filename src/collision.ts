import { System, Circle, Body } from 'detect-collisions';
import { World, Creature, Node, Food, SegmentType } from './types';

// User data for collision bodies
interface BodyUserData {
  type: 'node' | 'food';
  creatureId?: number;
  nodeId?: number;
  foodId?: number;
}

// Type alias for our collision bodies
type CollisionBody = Circle<BodyUserData>;

export class CollisionSystem {
  private system: System;
  private bodies: Map<string, CollisionBody> = new Map();

  constructor() {
    this.system = new System();
  }

  // Clear all bodies
  clear(): void {
    for (const body of this.bodies.values()) {
      this.system.remove(body);
    }
    this.bodies.clear();
  }

  // Update collision bodies to match world state
  sync(world: World): void {
    const activeKeys = new Set<string>();

    // Sync creature nodes
    for (const creature of world.creatures) {
      if (!creature.alive) continue;

      for (const node of creature.nodes) {
        const key = `c${creature.id}_n${node.id}`;
        activeKeys.add(key);

        let body = this.bodies.get(key);
        if (!body) {
          body = this.system.createCircle(
            { x: node.x, y: node.y },
            node.gene.size
          ) as CollisionBody;
          body.userData = {
            type: 'node',
            creatureId: creature.id,
            nodeId: node.id,
          };
          this.bodies.set(key, body);
        } else {
          body.setPosition(node.x, node.y);
          body.r = node.gene.size;
        }
      }
    }

    // Sync food
    for (const food of world.food) {
      const key = `f${food.id}`;
      activeKeys.add(key);

      let body = this.bodies.get(key);
      if (!body) {
        body = this.system.createCircle(
          { x: food.x, y: food.y },
          food.radius
        ) as CollisionBody;
        body.userData = {
          type: 'food',
          foodId: food.id,
        };
        this.bodies.set(key, body);
      } else {
        body.setPosition(food.x, food.y);
      }
    }

    // Remove stale bodies
    for (const [key, body] of this.bodies) {
      if (!activeKeys.has(key)) {
        this.system.remove(body);
        this.bodies.delete(key);
      }
    }

    // Update spatial index
    this.system.update();
  }

  // Check for collisions and return collision pairs
  getCollisions(): CollisionPair[] {
    const pairs: CollisionPair[] = [];

    this.system.checkAll((response) => {
      const bodyA = response.a as CollisionBody;
      const bodyB = response.b as CollisionBody;

      if (bodyA.userData && bodyB.userData) {
        pairs.push({
          a: bodyA.userData,
          b: bodyB.userData,
          overlap: response.overlap,
          overlapV: { x: response.overlapV.x, y: response.overlapV.y },
        });
      }
    });

    return pairs;
  }
}

export interface CollisionPair {
  a: {
    type: 'node' | 'food';
    creatureId?: number;
    nodeId?: number;
    foodId?: number;
  };
  b: {
    type: 'node' | 'food';
    creatureId?: number;
    nodeId?: number;
    foodId?: number;
  };
  overlap: number;
  overlapV: { x: number; y: number };
}

// Process collisions and apply game logic
export function processCollisions(world: World, pairs: CollisionPair[]): void {
  const foodToRemove = new Set<number>();
  const matingPairs: [Creature, Creature][] = [];

  for (const pair of pairs) {
    // Node-Food collision
    if (
      (pair.a.type === 'node' && pair.b.type === 'food') ||
      (pair.a.type === 'food' && pair.b.type === 'node')
    ) {
      const nodeData = pair.a.type === 'node' ? pair.a : pair.b;
      const foodData = pair.a.type === 'food' ? pair.a : pair.b;

      const creature = world.creatures.find(c => c.id === nodeData.creatureId);
      const food = world.food.find(f => f.id === foodData.foodId);

      if (creature && food && creature.alive) {
        const node = creature.nodes.find(n => n.id === nodeData.nodeId);

        if (node && node.gene.type === SegmentType.Sucker) {
          // Sucker node eats food
          const efficiency = node.gene.efficiency ?? 0.5;
          creature.energy += food.energy * efficiency;
          foodToRemove.add(food.id);
        }
      }
    }

    // Node-Node collision (between different creatures)
    if (
      pair.a.type === 'node' &&
      pair.b.type === 'node' &&
      pair.a.creatureId !== pair.b.creatureId
    ) {
      const creatureA = world.creatures.find(c => c.id === pair.a.creatureId);
      const creatureB = world.creatures.find(c => c.id === pair.b.creatureId);

      if (!creatureA || !creatureB || !creatureA.alive || !creatureB.alive) continue;

      const nodeA = creatureA.nodes.find(n => n.id === pair.a.nodeId);
      const nodeB = creatureB.nodes.find(n => n.id === pair.b.nodeId);

      if (!nodeA || !nodeB) continue;

      // Sucker drains energy from other creature (50% transfer efficiency - energy is lost)
      if (nodeA.gene.type === SegmentType.Sucker) {
        const efficiency = nodeA.gene.efficiency ?? 0.5;
        const drain = Math.min(creatureB.energy, efficiency * 0.5);
        creatureA.energy += drain * 0.5; // Only 50% transferred
        creatureB.energy -= drain;
      }

      if (nodeB.gene.type === SegmentType.Sucker) {
        const efficiency = nodeB.gene.efficiency ?? 0.5;
        const drain = Math.min(creatureA.energy, efficiency * 0.5);
        creatureB.energy += drain * 0.5; // Only 50% transferred
        creatureA.energy -= drain;
      }

      // Mating nodes trigger reproduction
      if (
        nodeA.gene.type === SegmentType.Mating &&
        nodeB.gene.type === SegmentType.Mating
      ) {
        // Check energy threshold
        if (
          creatureA.energy < world.config.matingEnergyThreshold ||
          creatureB.energy < world.config.matingEnergyThreshold
        ) {
          continue;
        }

        // Check if either creature is already in a mating pair this tick
        const aAlreadyMating = matingPairs.some(
          ([a, b]) => a.id === creatureA.id || b.id === creatureA.id
        );
        const bAlreadyMating = matingPairs.some(
          ([a, b]) => a.id === creatureB.id || b.id === creatureB.id
        );
        if (!aAlreadyMating && !bAlreadyMating) {
          matingPairs.push([creatureA, creatureB]);
        }
      }

      // Physical separation (push apart)
      const nodeAData = creatureA.nodes[pair.a.nodeId!];
      const nodeBData = creatureB.nodes[pair.b.nodeId!];
      if (nodeAData && nodeBData) {
        const pushForce = 0.3;
        nodeAData.vx -= pair.overlapV.x * pushForce;
        nodeAData.vy -= pair.overlapV.y * pushForce;
        nodeBData.vx += pair.overlapV.x * pushForce;
        nodeBData.vy += pair.overlapV.y * pushForce;
      }
    }
  }

  // Remove eaten food
  world.food = world.food.filter(f => !foodToRemove.has(f.id));

  // Process mating (handled in simulation.ts to avoid circular deps)
  // Store mating pairs for later processing
  (world as any)._pendingMating = matingPairs;
}
