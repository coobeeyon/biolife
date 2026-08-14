const test = require('node:test');
const assert = require('node:assert/strict');

const {
  angularVelocity,
  centerOfMass,
  creature,
  link,
  node,
  step,
  world,
} = require('./physics-harness.cjs');

test('passive rotational drag monotonically removes angular velocity', () => {
  const nodes = [
    node(0, 4, -30, 0, 0, -0.1),
    node(1, 4, 30, 0, 0, 0.1),
  ];
  const rod = link(0, 1, 60, 0);
  const subject = creature(nodes, [rod]);
  const environment = world(subject);
  let previousMagnitude = Math.abs(angularVelocity(subject, rod));

  for (let index = 0; index < 40; index++) {
    step(subject, environment, 1);
    const magnitude = Math.abs(angularVelocity(subject, rod));
    assert.ok(
      magnitude < previousMagnitude,
      `angular velocity grew at step ${index + 1}: ${previousMagnitude} -> ${magnitude}`,
    );
    previousMagnitude = magnitude;
  }
});

test('a symmetric resting creature remains at rest without drift or yaw', () => {
  const legLength = 60;
  const halfTail = 30;
  const tailX = Math.sqrt(legLength ** 2 - halfTail ** 2);
  const nodes = [
    node(0, 8, 0, 0),
    node(1, 4, tailX, -halfTail),
    node(2, 4, tailX, halfTail),
  ];
  const subject = creature(nodes, [
    link(0, 1, legLength),
    link(0, 2, legLength),
    link(1, 2, halfTail * 2),
  ]);
  const environment = world(subject);
  const initialCenter = centerOfMass(subject);

  step(subject, environment, 600);

  const finalCenter = centerOfMass(subject);
  assert.ok(Math.abs(finalCenter.x - initialCenter.x) < 1e-12);
  assert.ok(Math.abs(finalCenter.y - initialCenter.y) < 1e-12);
  assert.ok(Math.abs(subject.nodes[1].y + subject.nodes[2].y) < 1e-12);
  assert.ok(Math.abs(subject.nodes[1].x - subject.nodes[2].x) < 1e-12);
});

test('a reciprocal one-degree-of-freedom stroke has negligible net travel', () => {
  const legLength = 60;
  const halfTail = 30;
  const tailX = Math.sqrt(legLength ** 2 - halfTail ** 2);
  const nodes = [
    node(0, 10, 0, 0),
    node(1, 3, tailX, -halfTail),
    node(2, 3, tailX, halfTail),
  ];
  const actuator = link(1, 2, halfTail * 2, 1);
  const subject = creature(nodes, [
    link(0, 1, legLength),
    link(0, 2, legLength),
    actuator,
  ]);
  const environment = world(subject);
  // Slow actuation keeps this damped inertial approximation near its
  // intended low-Reynolds-number regime. Two warm-up cycles remove the
  // initial spring transient before displacement is measured.
  const period = 1_200;
  const driveActuator = (tick) => {
    actuator.restLength = 60 + 20 * Math.sin((2 * Math.PI * tick) / period);
  };

  step(subject, environment, period * 2, { beforeStep: driveActuator });
  const initialCenter = centerOfMass(subject);
  step(subject, environment, period, { beforeStep: driveActuator });

  const finalCenter = centerOfMass(subject);
  const displacement = Math.hypot(
    finalCenter.x - initialCenter.x,
    finalCenter.y - initialCenter.y,
  );
  assert.ok(displacement < 0.1, `reciprocal stroke traveled ${displacement}`);
});
