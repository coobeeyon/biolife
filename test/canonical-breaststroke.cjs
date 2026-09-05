const {
  centerOfMass,
  distance,
  step,
  world,
} = require('./physics-harness.cjs');
const {
  CANONICAL_NARROW_HAND_SEPARATION,
  CANONICAL_SHORT_ARM_LENGTH,
  CANONICAL_STROKE_CYCLE_DURATION,
  applyCanonicalBreaststroke,
  createCanonicalSwimmer,
} = require('../node_modules/.cache/biolife-tests/canonical-swimmer.js');

function createCanonicalBreaststroke(options = {}) {
  const { dt = 1, reverse = false } = options;
  const subject = createCanonicalSwimmer(1);

  return {
    dt,
    reverse,
    subject,
    environment: world(subject),
    upperArm: subject.links[0],
    lowerArm: subject.links[1],
    hands: subject.links[2],
  };
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
  const stepCount = Math.round(CANONICAL_STROKE_CYCLE_DURATION / simulation.dt);
  if (Math.abs(stepCount * simulation.dt - CANONICAL_STROKE_CYCLE_DURATION) > 1e-9) {
    throw new Error('dt must divide the canonical stroke cycle exactly');
  }

  const before = centerOfMass(simulation.subject);
  step(simulation.subject, simulation.environment, stepCount, {
    dt: simulation.dt,
    beforeStep: (time) => applyCanonicalBreaststroke(
      simulation.subject,
      time,
      simulation.reverse,
    ),
  });
  applyCanonicalBreaststroke(
    simulation.subject,
    simulation.environment.tick * simulation.dt,
    simulation.reverse,
  );
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
  CYCLE_DURATION: CANONICAL_STROKE_CYCLE_DURATION,
  NARROW_HAND_SEPARATION: CANONICAL_NARROW_HAND_SEPARATION,
  SHORT_ARM_LENGTH: CANONICAL_SHORT_ARM_LENGTH,
  advanceStrokeCycle,
  createCanonicalBreaststroke,
};
