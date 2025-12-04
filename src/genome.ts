import { NodeGene, SegmentType, Genome } from './types';

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

    // Remaining parts are links
    const links: number[] = [];
    for (let i = 3; i < parts.length; i++) {
      const link = parseInt(parts[i]);
      if (!isNaN(link)) {
        links.push(link);
      }
    }

    genes.push({
      type,
      size,
      efficiency,
      links,
    });
  }

  return genes;
}

// Serialize a genome back to string format
export function serializeGenome(genome: Genome): string {
  return genome.map(gene => {
    const parts = [
      gene.type,
      gene.size.toFixed(1),
      (gene.efficiency ?? 0.5).toFixed(2),
      ...gene.links.map(c => (c >= 0 ? '+' : '') + c),
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
    ...genomeA.slice(0, cutA).map(g => ({ ...g, links: [...g.links] })),
    ...genomeB.slice(cutB).map(g => ({ ...g, links: [...g.links] })),
  ];

  // Ensure at least one node
  if (child.length === 0) {
    return Math.random() < 0.5
      ? genomeA.map(g => ({ ...g, links: [...g.links] }))
      : genomeB.map(g => ({ ...g, links: [...g.links] }));
  }

  return child;
}

// Mutate a genome
export function mutate(genome: Genome, rate: number, strength: number): Genome {
  const types = Object.values(SegmentType);

  return genome.map(gene => {
    const mutated = { ...gene, links: [...gene.links] };

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
        mutated.links.splice(idx, 1);
      } else if (action < 0.66) {
        // Add a link
        const newLink = Math.floor(Math.random() * 7) - 3; // -3 to +3
        if (newLink !== 0) {
          mutated.links.push(newLink);
        }
      } else if (mutated.links.length > 0) {
        // Modify a link
        const idx = Math.floor(Math.random() * mutated.links.length);
        mutated.links[idx] += Math.random() < 0.5 ? 1 : -1;
        if (mutated.links[idx] === 0) {
          mutated.links[idx] = Math.random() < 0.5 ? 1 : -1;
        }
      }
    }

    return mutated;
  }).filter(() => {
    // Small chance to delete a node entirely
    return Math.random() > rate * 0.1;
  }).concat(
    // Small chance to duplicate a node
    Math.random() < rate * 0.2 && genome.length > 0
      ? [{ ...genome[Math.floor(Math.random() * genome.length)], links: [...genome[Math.floor(Math.random() * genome.length)].links] }]
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

    genome.push({
      type: types[Math.floor(Math.random() * types.length)],
      size: 3 + Math.random() * 7,
      efficiency: 0.3 + Math.random() * 0.5,
      links,
    });
  }

  return genome;
}
