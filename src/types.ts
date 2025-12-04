// Segment types - color determines function
export enum SegmentType {
  Neutral = 'neutral',   // Structural only
  Sucker = 'sucker',     // Drains energy from food/creatures
  Solar = 'solar',       // Generates energy from insolation
  Mating = 'mating',     // Triggers reproduction on contact
}

// Gene for a single node
export interface NodeGene {
  type: SegmentType;
  size: number;                    // Radius of node
  links: number[];                 // Relative links (e.g., +1, -2)
  efficiency?: number;             // For sucker nodes - how efficiently they drain
}

// Full genome is an array of node genes
export type Genome = NodeGene[];

// Runtime node (instantiated from gene)
export interface Node {
  id: number;
  gene: NodeGene;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// Link between two nodes - a spring with optional actuation
export interface Link {
  nodeA: number;           // Index into creature's nodes
  nodeB: number;
  restLength: number;      // Base rest length
  stiffness: number;
  // Actuation params (oscillates rest length)
  actuationAmp: number;    // Amplitude as fraction of rest length
  actuationFreq: number;   // Oscillation frequency
  actuationPhase: number;  // Phase offset
}

// Creature - a living entity
export interface Creature {
  id: number;
  nodes: Node[];
  links: Link[];
  genome: Genome;
  energy: number;
  age: number;
  alive: boolean;
}

// Food particle
export interface Food {
  id: number;
  x: number;
  y: number;
  energy: number;
  radius: number;
}

// World configuration
export interface WorldConfig {
  width: number;
  height: number;
  viscosity: number;           // Drag coefficient
  insolation: number;          // Energy per tick for solar segments
  foodSpawnRate: number;       // Food particles per tick
  foodEnergy: number;          // Energy per food particle
  matingEnergyCost: number;    // Energy cost to reproduce
  matingEnergyThreshold: number; // Minimum energy to reproduce
  divisionEnergyThreshold: number; // Energy at which creature splits asexually
  mutationRate: number;        // Probability of mutation per gene
  mutationStrength: number;    // How much values can mutate
}

// Simulation state
export interface World {
  config: WorldConfig;
  creatures: Creature[];
  food: Food[];
  tick: number;
  nextCreatureId: number;
  nextFoodId: number;
}
