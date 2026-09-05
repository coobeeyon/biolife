import { Creature, Link, Node, SegmentType } from './types';

export const CANONICAL_SHORT_ARM_LENGTH = 45;
export const CANONICAL_LONG_ARM_LENGTH = 75;
export const CANONICAL_NARROW_HAND_SEPARATION = 20;
export const CANONICAL_WIDE_HAND_SEPARATION = 70;
export const CANONICAL_STROKE_PHASE_DURATION = 300;
export const CANONICAL_STROKE_CYCLE_DURATION = CANONICAL_STROKE_PHASE_DURATION * 4;

const SHAPE_CORNERS = [
  [CANONICAL_SHORT_ARM_LENGTH, CANONICAL_NARROW_HAND_SEPARATION],
  [CANONICAL_LONG_ARM_LENGTH, CANONICAL_NARROW_HAND_SEPARATION],
  [CANONICAL_LONG_ARM_LENGTH, CANONICAL_WIDE_HAND_SEPARATION],
  [CANONICAL_SHORT_ARM_LENGTH, CANONICAL_WIDE_HAND_SEPARATION],
  [CANONICAL_SHORT_ARM_LENGTH, CANONICAL_NARROW_HAND_SEPARATION],
] as const;

export const CANONICAL_STROKE_PHASES = [
  'extend narrow',
  'open hands',
  'pull wide',
  'recover narrow',
] as const;

function createNode(id: number, size: number, x: number, y: number): Node {
  return {
    id,
    gene: { type: SegmentType.Neutral, size, links: [], efficiency: 0.5 },
    x,
    y,
    vx: 0,
    vy: 0,
  };
}

function createLink(nodeA: number, nodeB: number, restLength: number): Link {
  return {
    nodeA,
    nodeB,
    restLength,
    stiffness: 1,
    actuationAmp: 0,
    actuationFreq: 0,
    actuationPhase: 0,
  };
}

export function createCanonicalSwimmer(
  id: number,
  x: number = 0,
  y: number = 0,
  energy: number = 1_000_000,
): Creature {
  const halfSeparation = CANONICAL_NARROW_HAND_SEPARATION / 2;
  const handX = Math.sqrt(CANONICAL_SHORT_ARM_LENGTH ** 2 - halfSeparation ** 2);
  const nodes = [
    createNode(0, 10, x, y),
    createNode(1, 3, x + handX, y - halfSeparation),
    createNode(2, 3, x + handX, y + halfSeparation),
  ];

  return {
    id,
    nodes,
    links: [
      createLink(0, 1, CANONICAL_SHORT_ARM_LENGTH),
      createLink(0, 2, CANONICAL_SHORT_ARM_LENGTH),
      createLink(1, 2, CANONICAL_NARROW_HAND_SEPARATION),
    ],
    genome: nodes.map((item) => ({ ...item.gene, links: [] })),
    energy,
    age: 0,
    alive: true,
  };
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function mix(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function getCycleTime(time: number, reverse: boolean): number {
  let cycleTime = (
    (time % CANONICAL_STROKE_CYCLE_DURATION) + CANONICAL_STROKE_CYCLE_DURATION
  ) % CANONICAL_STROKE_CYCLE_DURATION;

  if (reverse) {
    cycleTime = (
      CANONICAL_STROKE_CYCLE_DURATION - cycleTime
    ) % CANONICAL_STROKE_CYCLE_DURATION;
  }

  return cycleTime;
}

export function getCanonicalStrokePhase(time: number, reverse: boolean = false): number {
  return Math.min(
    3,
    Math.floor(getCycleTime(time, reverse) / CANONICAL_STROKE_PHASE_DURATION),
  );
}

export function applyCanonicalBreaststroke(
  swimmer: Creature,
  time: number,
  reverse: boolean = false,
): void {
  if (swimmer.links.length < 3) {
    throw new Error('Canonical swimmer requires three links');
  }

  const cycleTime = getCycleTime(time, reverse);
  const phase = Math.min(3, Math.floor(cycleTime / CANONICAL_STROKE_PHASE_DURATION));
  const phaseTime = cycleTime - phase * CANONICAL_STROKE_PHASE_DURATION;
  const progress = smoothstep(phaseTime / CANONICAL_STROKE_PHASE_DURATION);
  const from = SHAPE_CORNERS[phase];
  const to = SHAPE_CORNERS[phase + 1];
  const armLength = mix(from[0], to[0], progress);
  const handSeparation = mix(from[1], to[1], progress);

  swimmer.links[0].restLength = armLength;
  swimmer.links[1].restLength = armLength;
  swimmer.links[2].restLength = handSeparation;
}
