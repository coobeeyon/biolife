const {
  centerOfMass,
  creature,
  distance,
  link,
  node,
  step,
  world,
} = require('./physics-harness.cjs');

const SHORT_ARM_LENGTH = 45;
const LONG_ARM_LENGTH = 75;
const NARROW_HAND_SEPARATION = 20;
const WIDE_HAND_SEPARATION = 70;
const PHASE_DURATION = 300;
const CYCLE_DURATION = PHASE_DURATION * 4;

const SHAPE_CORNERS = [
  [SHORT_ARM_LENGTH, NARROW_HAND_SEPARATION],
  [LONG_ARM_LENGTH, NARROW_HAND_SEPARATION],
  [LONG_ARM_LENGTH, WIDE_HAND_SEPARATION],
  [SHORT_ARM_LENGTH, WIDE_HAND_SEPARATION],
  [SHORT_ARM_LENGTH, NARROW_HAND_SEPARATION],
];

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function mix(from, to, progress) {
  return from + (to - from) * progress;
}

function createCanonicalBreaststroke(options = {}) {
  const { dt = 1, reverse = false } = options;
  const halfSeparation = NARROW_HAND_SEPARATION / 2;
  const handX = Math.sqrt(SHORT_ARM_LENGTH ** 2 - halfSeparation ** 2);
  const nodes = [
    node(0, 10, 0, 0),
    node(1, 3, handX, -halfSeparation),
    node(2, 3, handX, halfSeparation),
  ];
  const upperArm = link(0, 1, SHORT_ARM_LENGTH, 1);
  const lowerArm = link(0, 2, SHORT_ARM_LENGTH, 1);
  const hands = link(1, 2, NARROW_HAND_SEPARATION, 1);
  const subject = creature(nodes, [upperArm, lowerArm, hands]);

  return {
    dt,
    reverse,
    subject,
    environment: world(subject),
    upperArm,
    lowerArm,
    hands,
  };
}

function setStrokeShape(simulation, time) {
  let cycleTime = ((time % CYCLE_DURATION) + CYCLE_DURATION) % CYCLE_DURATION;
  if (simulation.reverse) {
    cycleTime = (CYCLE_DURATION - cycleTime) % CYCLE_DURATION;
  }

  const phase = Math.min(3, Math.floor(cycleTime / PHASE_DURATION));
  const phaseTime = cycleTime - phase * PHASE_DURATION;
  const progress = smoothstep(phaseTime / PHASE_DURATION);
  const from = SHAPE_CORNERS[phase];
  const to = SHAPE_CORNERS[phase + 1];
  const armLength = mix(from[0], to[0], progress);
  const handSeparation = mix(from[1], to[1], progress);

  simulation.upperArm.restLength = armLength;
  simulation.lowerArm.restLength = armLength;
  simulation.hands.restLength = handSeparation;
}

function bodyYaw(subject) {
  const head = subject.nodes[0];
  const handCenterX = (subject.nodes[1].x + subject.nodes[2].x) / 2;
  const handCenterY = (subject.nodes[1].y + subject.nodes[2].y) / 2;
  return Math.atan2(handCenterY - head.y, handCenterX - head.x);
}

function bodyShape(subject) {
  return [
    distance(subject, 0, 1),
    distance(subject, 0, 2),
    distance(subject, 1, 2),
  ];
}

function advanceStrokeCycle(simulation) {
  const stepCount = Math.round(CYCLE_DURATION / simulation.dt);
  if (Math.abs(stepCount * simulation.dt - CYCLE_DURATION) > 1e-9) {
    throw new Error('dt must divide the canonical stroke cycle exactly');
  }

  const before = centerOfMass(simulation.subject);
  step(simulation.subject, simulation.environment, stepCount, {
    dt: simulation.dt,
    beforeStep: (time) => setStrokeShape(simulation, time),
  });
  setStrokeShape(simulation, simulation.environment.tick * simulation.dt);
  const after = centerOfMass(simulation.subject);

  return {
    forward: after.x - before.x,
    lateral: after.y - before.y,
    yaw: bodyYaw(simulation.subject),
    shape: bodyShape(simulation.subject),
    targetShape: [
      simulation.upperArm.restLength,
      simulation.lowerArm.restLength,
      simulation.hands.restLength,
    ],
  };
}

module.exports = {
  CYCLE_DURATION,
  NARROW_HAND_SEPARATION,
  SHORT_ARM_LENGTH,
  advanceStrokeCycle,
  createCanonicalBreaststroke,
};
