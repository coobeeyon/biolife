import { Creature, Node, Link, Genome } from './types';

// Create a creature from a genome at a given position
export function createCreature(
  id: number,
  genome: Genome,
  x: number,
  y: number,
  startingEnergy: number
): Creature {
  if (genome.length === 0) {
    throw new Error('Cannot create creature with empty genome');
  }

  const nodes: Node[] = [];
  const linkSet = new Set<string>(); // To avoid duplicate links
  const links: Link[] = [];

  // Create nodes, positioning them relative to each other
  for (let i = 0; i < genome.length; i++) {
    const gene = genome[i];

    // Position: first node at origin, others positioned based on links
    let nodeX = x;
    let nodeY = y;

    if (i > 0) {
      // Find a node we're linked to and position relative to it
      const linkedIdx = resolveLink(i, gene.links[0] ?? -1, genome.length);
      if (linkedIdx !== null && linkedIdx < nodes.length) {
        const parent = nodes[linkedIdx];
        // Position at an angle - creates non-collinear structure
        // Use a consistent angle offset to create zigzag/branching patterns
        const baseAngle = i * 0.8 + Math.random() * 0.5;
        const dist = parent.gene.size + gene.size + 2;
        nodeX = parent.x + Math.cos(baseAngle) * dist;
        nodeY = parent.y + Math.sin(baseAngle) * dist;
      } else {
        // Fallback: position relative to previous node
        const prev = nodes[i - 1];
        const baseAngle = i * 0.8 + Math.random() * 0.5;
        const dist = prev.gene.size + gene.size + 2;
        nodeX = prev.x + Math.cos(baseAngle) * dist;
        nodeY = prev.y + Math.sin(baseAngle) * dist;
      }
    }

    nodes.push({
      id: i,
      gene,
      x: nodeX,
      y: nodeY,
      vx: 0,
      vy: 0,
    });
  }

  // Create links based on genome
  for (let i = 0; i < genome.length; i++) {
    const gene = genome[i];

    for (const relLink of gene.links) {
      const targetIdx = resolveLink(i, relLink, genome.length);
      if (targetIdx !== null && targetIdx !== i) {
        // Create unique key for link (order independent)
        const key = [Math.min(i, targetIdx), Math.max(i, targetIdx)].join('-');

        if (!linkSet.has(key)) {
          linkSet.add(key);

          const nodeA = nodes[i];
          const nodeB = nodes[targetIdx];
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const restLength = Math.sqrt(dx * dx + dy * dy);

          // Only ~20% of links have actuation
          const hasActuation = Math.random() < 0.2;
          links.push({
            nodeA: i,
            nodeB: targetIdx,
            restLength,
            stiffness: 2.0,
            actuationAmp: hasActuation ? 0.2 + Math.random() * 0.3 : 0,
            actuationFreq: hasActuation ? 1.0 + Math.random() * 2 : 0,
            actuationPhase: hasActuation ? Math.random() * Math.PI * 2 : 0,
          });
        }
      }
    }
  }

  return {
    id,
    nodes,
    links,
    genome,
    energy: startingEnergy,
    age: 0,
    alive: true,
  };
}

// Resolve a relative link to an absolute index
function resolveLink(currentIdx: number, relativeLink: number, genomeLength: number): number | null {
  const targetIdx = currentIdx + relativeLink;

  // Wrap around if out of bounds (creates interesting topology)
  if (targetIdx < 0) {
    return (genomeLength + (targetIdx % genomeLength)) % genomeLength;
  }
  if (targetIdx >= genomeLength) {
    return targetIdx % genomeLength;
  }

  return targetIdx;
}

// Get the center of mass of a creature
export function getCreatureCenter(creature: Creature): { x: number; y: number } {
  if (creature.nodes.length === 0) {
    return { x: 0, y: 0 };
  }

  let totalMass = 0;
  let cx = 0;
  let cy = 0;

  for (const node of creature.nodes) {
    const mass = node.gene.size * node.gene.size; // Mass proportional to area
    cx += node.x * mass;
    cy += node.y * mass;
    totalMass += mass;
  }

  return {
    x: cx / totalMass,
    y: cy / totalMass,
  };
}

// Get the total mass of a creature
export function getCreatureMass(creature: Creature): number {
  return creature.nodes.reduce((sum, node) => sum + node.gene.size * node.gene.size, 0);
}

// Calculate energy efficiency multiplier based on current energy
// Returns 0-1, used to scale actuation strength
export function getEnergyEfficiency(creature: Creature, maxEnergy: number = 100): number {
  const ratio = creature.energy / maxEnergy;

  if (ratio <= 0) return 0;
  if (ratio >= 0.5) return 1;

  // Linear falloff below 50% energy
  return ratio * 2;
}
