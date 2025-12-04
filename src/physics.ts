import { Creature, Node, Link, World } from './types';
import { getEnergyEfficiency } from './creature';

// Apply viscous drag to a node (circle) - isotropic
// Reduced significantly so link drag dominates
function applyNodeDrag(node: Node, viscosity: number): void {
  const dragCoeff = viscosity * node.gene.size * 0.1; // 10% of original
  node.vx *= 1 / (1 + dragCoeff);
  node.vy *= 1 / (1 + dragCoeff);
}

// Apply viscous drag to a link (line segment) as a rigid paddle
// The link's center-of-mass perpendicular velocity determines drag
// Force is distributed equally to both endpoints
function applyLinkDrag(nodeA: Node, nodeB: Node, link: Link, viscosity: number): void {
  const dx = nodeB.x - nodeA.x;
  const dy = nodeB.y - nodeA.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 0.001;

  // Link direction (unit vector)
  const lx = dx / length;
  const ly = dy / length;

  // Perpendicular to link
  const px = -ly;
  const py = lx;

  // Link center velocity (average of endpoints)
  const centerVx = (nodeA.vx + nodeB.vx) / 2;
  const centerVy = (nodeA.vy + nodeB.vy) / 2;

  // Perpendicular component of center velocity
  const vPerp = centerVx * px + centerVy * py;

  // Drag force on the whole link: perpendicular velocity * link length * viscosity
  const dragForce = vPerp * length * viscosity;


  // Distribute force equally to both endpoints
  const massA = nodeA.gene.size * nodeA.gene.size;
  const massB = nodeB.gene.size * nodeB.gene.size;

  // Apply drag force opposing perpendicular motion (split between nodes)
  nodeA.vx -= px * dragForce * 0.5 / massA;
  nodeA.vy -= py * dragForce * 0.5 / massA;
  nodeB.vx -= px * dragForce * 0.5 / massB;
  nodeB.vy -= py * dragForce * 0.5 / massB;
}

// Calculate actuation energy cost for a creature
function getActuationCost(creature: Creature): number {
  return creature.links.reduce((cost, link) => {
    return cost + link.actuationAmp * link.actuationFreq * 0.001;
  }, 0);
}

// Apply spring forces between linked nodes, with oscillating rest length
function applyLinkForces(creature: Creature, tick: number, dt: number): void {
  const efficiency = getEnergyEfficiency(creature);

  for (const link of creature.links) {
    const nodeA = creature.nodes[link.nodeA];
    const nodeB = creature.nodes[link.nodeB];

    if (!nodeA || !nodeB) continue;

    const dx = nodeB.x - nodeA.x;
    const dy = nodeB.y - nodeA.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

    // Calculate target length (rest length + actuation)
    let targetLength = link.restLength;
    if (efficiency > 0 && link.actuationAmp > 0) {
      const phase = link.actuationPhase + tick * link.actuationFreq * 0.1;
      const wave = Math.sin(phase);
      targetLength = link.restLength * (1 + wave * link.actuationAmp * efficiency);
    }

    // Spring force to reach target length
    const displacement = dist - targetLength;
    const springForce = displacement * link.stiffness;

    const nx = dx / dist;
    const ny = dy / dist;

    const fx = springForce * nx;
    const fy = springForce * ny;

    // Apply forces (mass proportional to size squared)
    const massA = nodeA.gene.size * nodeA.gene.size;
    const massB = nodeB.gene.size * nodeB.gene.size;

    nodeA.vx += fx / massA;
    nodeA.vy += fy / massA;
    nodeB.vx -= fx / massB;
    nodeB.vy -= fy / massB;
  }

  // Deduct actuation energy cost
  if (efficiency > 0) {
    creature.energy -= getActuationCost(creature) * efficiency;
  }
}

// Prevent nodes of the same creature from overlapping
function applySelfCollision(creature: Creature): void {
  for (let i = 0; i < creature.nodes.length; i++) {
    for (let j = i + 1; j < creature.nodes.length; j++) {
      const nodeA = creature.nodes[i];
      const nodeB = creature.nodes[j];

      const dx = nodeB.x - nodeA.x;
      const dy = nodeB.y - nodeA.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const minDist = nodeA.gene.size + nodeB.gene.size;

      if (dist < minDist) {
        // Push apart
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;

        const massA = nodeA.gene.size * nodeA.gene.size;
        const massB = nodeB.gene.size * nodeB.gene.size;
        const totalMass = massA + massB;

        nodeA.x -= nx * overlap * (massB / totalMass);
        nodeA.y -= ny * overlap * (massB / totalMass);
        nodeB.x += nx * overlap * (massA / totalMass);
        nodeB.y += ny * overlap * (massA / totalMass);
      }
    }
  }
}

// Update positions based on velocities
function integrate(creature: Creature, dt: number): void {
  for (const node of creature.nodes) {
    node.x += node.vx * dt;
    node.y += node.vy * dt;
  }
}

// Keep creatures within world bounds
function applyBoundary(creature: Creature, width: number, height: number): void {
  const hw = width / 2;
  const hh = height / 2;

  for (const node of creature.nodes) {
    const r = node.gene.size;

    // Soft boundary - push back
    const boundaryForce = 0.5;

    if (node.x - r < -hw) {
      node.vx += boundaryForce;
      node.x = -hw + r;
    }
    if (node.x + r > hw) {
      node.vx -= boundaryForce;
      node.x = hw - r;
    }
    if (node.y - r < -hh) {
      node.vy += boundaryForce;
      node.y = -hh + r;
    }
    if (node.y + r > hh) {
      node.vy -= boundaryForce;
      node.y = hh - r;
    }
  }
}

// Main physics step for a single creature
export function updateCreaturePhysics(
  creature: Creature,
  world: World,
  dt: number
): void {
  if (!creature.alive) return;

  applyLinkForces(creature, world.tick, dt);
  applySelfCollision(creature);

  // Apply drag to links (anisotropic - creates swimming thrust)
  for (const link of creature.links) {
    const nodeA = creature.nodes[link.nodeA];
    const nodeB = creature.nodes[link.nodeB];
    if (nodeA && nodeB) {
      applyLinkDrag(nodeA, nodeB, link, world.config.viscosity);
    }
  }

  // Apply drag to nodes (isotropic)
  for (const node of creature.nodes) {
    applyNodeDrag(node, world.config.viscosity);
  }

  integrate(creature, dt);
  applyBoundary(creature, world.config.width, world.config.height);
}

// Update all physics in the world
export function updatePhysics(world: World, dt: number): void {
  for (const creature of world.creatures) {
    updateCreaturePhysics(creature, world, dt);
  }
}
