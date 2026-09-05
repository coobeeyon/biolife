import { GaitGene, NodeGene, SegmentType, Genome } from './types';

export const MAX_GAIT_AMPLITUDE = 0.5;
export const MAX_GAIT_FREQUENCY = 3;
const FULL_CIRCLE = Math.PI * 2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizePhase(phase: number): number {
  if (phase >= 0 && phase < FULL_CIRCLE) {
    return phase;
  }
  return ((phase % FULL_CIRCLE) + FULL_CIRCLE) % FULL_CIRCLE;
}

function normalizeGait(gait: GaitGene): GaitGene {
  return {
    amplitude: clamp(gait.amplitude, 0, MAX_GAIT_AMPLITUDE),
    frequency: clamp(gait.frequency, 0, MAX_GAIT_FREQUENCY),
    phase: normalizePhase(gait.phase),
  };
}

function randomGait(): GaitGene {
  return {
    amplitude: 0.2 + Math.random() * 0.3,
    frequency: 1 + Math.random() * 2,
    phase: Math.random() * FULL_CIRCLE,
  };
}

function cloneGene(gene: NodeGene): NodeGene {
  const linkGaits = gene.linkGaits
    ? Object.fromEntries(
        Object.entries(gene.linkGaits).map(([link, gait]) => [link, { ...gait }]),
      )
    : undefined;

  return {
    ...gene,
    links: [...gene.links],
    ...(linkGaits ? { linkGaits } : {}),
  };
}

// Parse a genome string into a Genome array
// Format: (type,size,efficiency,link1,link2,...)
// Example: (sucker,5,0.8,+1)(neutral,3,0.5,-1,+1)
export function parseGenome(genomeStr: string): Genome {
  const genes: NodeGene[] = [];
  const geneRegex = /\(([^)]+)\)/g;
  let match;

  while ((match = geneRegex.exec(genomeStr)) !== null) {
    const parts = match[1].split(',').map(s => s.trim());

    const type = parts[0] as SegmentType;
    const size = parseFloat(parts[1]) || 5;
    const efficiency = parseFloat(parts[2]) || 0.5;

    // Remaining parts are links. A gait suffix uses
    // relativeLink@amplitude:frequency:phase; legacy bare links stay passive.
    const links: number[] = [];
    const linkGaits: Record<string, GaitGene> = {};
    for (let i = 3; i < parts.length; i++) {
      const [linkPart, gaitPart] = parts[i].split('@');
      const link = parseInt(linkPart);
      if (!isNaN(link)) {
        links.push(link);

        if (gaitPart) {
          const values = gaitPart.split(':').map(Number);
          if (values.length === 3 && values.every(Number.isFinite)) {
            linkGaits[String(link)] = normalizeGait({
              amplitude: values[0],
              frequency: values[1],
              phase: values[2],
            });
          }
        }
      }
    }

    genes.push({
      type,
      size,
      efficiency,
      links,
      ...(Object.keys(linkGaits).length > 0 ? { linkGaits } : {}),
    });
  }

  return genes;
}

// Serialize a genome back to string format
export function serializeGenome(genome: Genome): string {
  return genome.map(gene => {
    const serializedLinks = gene.links.map(link => {
      const relativeLink = (link >= 0 ? '+' : '') + link;
      const gait = gene.linkGaits?.[String(link)];
      if (!gait) {
        return relativeLink;
      }

      const normalized = normalizeGait(gait);
      return `${relativeLink}@${normalized.amplitude.toFixed(3)}:${normalized.frequency.toFixed(3)}:${normalized.phase.toFixed(4)}`;
    });
    const parts = [
      gene.type,
      gene.size.toFixed(1),
      (gene.efficiency ?? 0.5).toFixed(2),
      ...serializedLinks,
    ];
    return `(${parts.join(',')})`;
  }).join('');
}

// Crossover two genomes
export function crossover(genomeA: Genome, genomeB: Genome): Genome {
  // Single point crossover
  const cutA = Math.floor(Math.random() * (genomeA.length + 1));
  const cutB = Math.floor(Math.random() * (genomeB.length + 1));

  const child: Genome = [
    ...genomeA.slice(0, cutA).map(cloneGene),
    ...genomeB.slice(cutB).map(cloneGene),
  ];

  // Ensure at least one node
  if (child.length === 0) {
    return Math.random() < 0.5
      ? genomeA.map(cloneGene)
      : genomeB.map(cloneGene);
  }

  return child;
}

// Mutate a genome
export function mutate(genome: Genome, rate: number, strength: number): Genome {
  if (rate <= 0) {
    return genome.map(cloneGene);
  }

  const types = Object.values(SegmentType);

  return genome.map(gene => {
    const mutated = cloneGene(gene);

    // Mutate type
    if (Math.random() < rate) {
      mutated.type = types[Math.floor(Math.random() * types.length)];
    }

    // Mutate size
    if (Math.random() < rate) {
      mutated.size = Math.max(1, mutated.size + (Math.random() - 0.5) * 2 * strength * 5);
    }

    // Mutate efficiency
    if (Math.random() < rate) {
      mutated.efficiency = Math.max(0.1, Math.min(1, (mutated.efficiency ?? 0.5) + (Math.random() - 0.5) * 2 * strength));
    }

    // Mutate links - add, remove, or change
    if (Math.random() < rate) {
      const action = Math.random();
      if (action < 0.33 && mutated.links.length > 0) {
        // Remove a link
        const idx = Math.floor(Math.random() * mutated.links.length);
        const removedLink = mutated.links[idx];
        mutated.links.splice(idx, 1);
        if (mutated.linkGaits) {
          delete mutated.linkGaits[String(removedLink)];
        }
      } else if (action < 0.66) {
        // Add a link
        const newLink = Math.floor(Math.random() * 7) - 3; // -3 to +3
        if (newLink !== 0) {
          mutated.links.push(newLink);
        }
      } else if (mutated.links.length > 0) {
        // Modify a link
        const idx = Math.floor(Math.random() * mutated.links.length);
        const oldLink = mutated.links[idx];
        mutated.links[idx] += Math.random() < 0.5 ? 1 : -1;
        if (mutated.links[idx] === 0) {
          mutated.links[idx] = Math.random() < 0.5 ? 1 : -1;
        }
        const newLink = mutated.links[idx];
        const inheritedGait = mutated.linkGaits?.[String(oldLink)];
        if (mutated.linkGaits && oldLink !== newLink) {
          delete mutated.linkGaits[String(oldLink)];
          if (inheritedGait) {
            mutated.linkGaits[String(newLink)] = inheritedGait;
          }
        }
      }
    }

    // Mutate gait parameters independently while keeping every value inside
    // the range accepted by the runtime. Passive links can acquire actuation.
    for (const link of mutated.links) {
      const key = String(link);
      let gait = mutated.linkGaits?.[key];
      if (!gait && Math.random() < rate * 0.2) {
        mutated.linkGaits ??= {};
        gait = randomGait();
        mutated.linkGaits[key] = gait;
      }
      if (!gait) continue;

      const next = { ...gait };
      if (Math.random() < rate) {
        next.amplitude += (Math.random() - 0.5) * strength * 0.5;
      }
      if (Math.random() < rate) {
        next.frequency += (Math.random() - 0.5) * strength * 3;
      }
      if (Math.random() < rate) {
        next.phase += (Math.random() - 0.5) * strength * FULL_CIRCLE;
      }
      mutated.linkGaits![key] = normalizeGait(next);
    }

    return mutated;
  }).filter(() => {
    // Small chance to delete a node entirely
    return Math.random() > rate * 0.1;
  }).concat(
    // Small chance to duplicate a node
    Math.random() < rate * 0.2 && genome.length > 0
      ? [cloneGene(genome[Math.floor(Math.random() * genome.length)])]
      : []
  );
}

// Generate a random genome
export function randomGenome(minNodes: number = 2, maxNodes: number = 6): Genome {
  const types = Object.values(SegmentType);
  const numNodes = minNodes + Math.floor(Math.random() * (maxNodes - minNodes + 1));

  const genome: Genome = [];

  for (let i = 0; i < numNodes; i++) {
    const links: number[] = [];

    // Link to previous node if not first
    if (i > 0) {
      links.push(-1);
    }

    // Maybe add more links
    if (Math.random() < 0.3 && i > 1) {
      const backRef = -Math.floor(Math.random() * Math.min(i, 3)) - 1;
      if (!links.includes(backRef)) {
        links.push(backRef);
      }
    }

    const linkGaits: Record<string, GaitGene> = {};
    for (const link of links) {
      if (Math.random() < 0.2) {
        linkGaits[String(link)] = randomGait();
      }
    }

    genome.push({
      type: types[Math.floor(Math.random() * types.length)],
      size: 3 + Math.random() * 7,
      efficiency: 0.3 + Math.random() * 0.5,
      links,
      ...(Object.keys(linkGaits).length > 0 ? { linkGaits } : {}),
    });
  }

  return genome;
}
