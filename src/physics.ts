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
// The link is a RIGID BODY with both translation and rotation
// Anisotropic: perpendicular motion has high drag, parallel motion has low drag
let dragDebugCounter = 0;
function applyLinkDrag(nodeA: Node, nodeB: Node, link: Link, viscosity: number, creatureId?: number): void {
  const dx = nodeB.x - nodeA.x;
  const dy = nodeB.y - nodeA.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 0.001;

  // Link direction (unit vector) - parallel to link
  const lx = dx / length;
  const ly = dy / length;

  // Perpendicular to link
  const px = -ly;
  const py = lx;

  // === TRANSLATIONAL DRAG ===
  // Link center velocity (average of endpoints)
  const centerVx = (nodeA.vx + nodeB.vx) / 2;
  const centerVy = (nodeA.vy + nodeB.vy) / 2;

  // Decompose center velocity into parallel and perpendicular components
  const vParallel = centerVx * lx + centerVy * ly;
  const vPerp = centerVx * px + centerVy * py;

  // Anisotropic drag coefficients
  const perpDragCoeff = length * viscosity;           // High drag broadside
  const parallelDragCoeff = length * viscosity * 0.1; // Low drag lengthwise (10%)

  // Translational drag force on the whole link
  const transDragFx = -(px * vPerp * perpDragCoeff + lx * vParallel * parallelDragCoeff);
  const transDragFy = -(py * vPerp * perpDragCoeff + ly * vParallel * parallelDragCoeff);

  // === ROTATIONAL DRAG ===
  // Angular velocity: difference in perpendicular velocities divided by length
  // vPerpA and vPerpB are the perpendicular velocity components at each endpoint
  const vPerpA = nodeA.vx * px + nodeA.vy * py;
  const vPerpB = nodeB.vx * px + nodeB.vy * py;

  // The difference in perpendicular velocities indicates rotation
  // omega = (vPerpB - vPerpA) / length
  const omega = (vPerpB - vPerpA) / length;

  // Rotational drag creates a torque that opposes rotation
  // For a rod rotating about its center, drag torque = integral of r * drag(r) dr
  // This works out to: torque = (1/12) * length^3 * viscosity * omega
  const rotDragTorque = -(1/12) * length * length * length * viscosity * omega;

  // Convert torque to forces at endpoints (force = torque / (length/2))
  // Force at A is perpendicular, in direction to oppose rotation
  // Force at B is opposite
  const rotForceMag = rotDragTorque / (length / 2);
  const rotDragFxA = px * rotForceMag * 0.5;
  const rotDragFyA = py * rotForceMag * 0.5;
  const rotDragFxB = -px * rotForceMag * 0.5;
  const rotDragFyB = -py * rotForceMag * 0.5;

  // === APPLY FORCES ===
  const massA = nodeA.gene.size * nodeA.gene.size;
  const massB = nodeB.gene.size * nodeB.gene.size;

  // Translational drag split equally
  nodeA.vx += (transDragFx * 0.5) / massA;
  nodeA.vy += (transDragFy * 0.5) / massA;
  nodeB.vx += (transDragFx * 0.5) / massB;
  nodeB.vy += (transDragFy * 0.5) / massB;

  // Rotational drag applied differentially
  nodeA.vx += rotDragFxA / massA;
  nodeA.vy += rotDragFyA / massA;
  nodeB.vx += rotDragFxB / massB;
  nodeB.vy += rotDragFyB / massB;

  // Debug: only log for creature ID 99
  if (creatureId === 99 && dragDebugCounter++ % 60 === 0) {
    if (Math.abs(omega) > 0.001 || Math.abs(vPerp) > 0.01) {
      console.log(`Link ${link.nodeA}-${link.nodeB}: vPerp=${vPerp.toFixed(3)} omega=${omega.toFixed(4)} transDrag=(${transDragFx.toFixed(3)},${transDragFy.toFixed(3)})`);
    }
  }
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

    // Mass proportional to size squared
    const massA = nodeA.gene.size * nodeA.gene.size;
    const massB = nodeB.gene.size * nodeB.gene.size;

    // Damping force - opposes relative velocity along the spring
    // Critical damping: c = 2 * sqrt(k * m_reduced)
    const relVx = nodeB.vx - nodeA.vx;
    const relVy = nodeB.vy - nodeA.vy;
    const relVelAlongSpring = relVx * nx + relVy * ny;
    const reducedMass = (massA * massB) / (massA + massB);
    const criticalDamping = 2 * Math.sqrt(link.stiffness * reducedMass);
    const dampingForce = relVelAlongSpring * criticalDamping * 0.5;  // 0.5x worked before

    // Total force = spring + damping
    const fx = (springForce + dampingForce) * nx;
    const fy = (springForce + dampingForce) * ny;

    // Apply forces
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
let physicsDebugCounter = 0;
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
      applyLinkDrag(nodeA, nodeB, link, world.config.viscosity, creature.id);
    }
  }

  // Apply drag to nodes (isotropic)
  for (const node of creature.nodes) {
    applyNodeDrag(node, world.config.viscosity);
  }

  // Debug: log creature center of mass velocity for test triangle
  if (creature.nodes.length === 3 && physicsDebugCounter++ % 120 === 0) {
    let totalMass = 0;
    let comVx = 0, comVy = 0;
    for (const node of creature.nodes) {
      const mass = node.gene.size * node.gene.size;
      totalMass += mass;
      comVx += node.vx * mass;
      comVy += node.vy * mass;
    }
    comVx /= totalMass;
    comVy /= totalMass;
    console.log(`COM velocity: (${comVx.toFixed(4)}, ${comVy.toFixed(4)})`);
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
