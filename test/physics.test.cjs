const test = require('node:test');
const assert = require('node:assert/strict');

const { updateCreaturePhysics } = require('../node_modules/.cache/biolife-tests/physics.js');

const WORLD_SIZE = 1_000_000;

function gene(size) {
  return { type: 'neutral', size, links: [], efficiency: 0.5 };
}

function node(id, size, x, y, vx = 0, vy = 0) {
  return { id, gene: gene(size), x, y, vx, vy };
}

function link(nodeA, nodeB, restLength, stiffness = 2) {
  return {
    nodeA,
    nodeB,
    restLength,
    stiffness,
    actuationAmp: 0,
    actuationFreq: 0,
    actuationPhase: 0,
  };
}

function creature(nodes, links) {
  return {
    id: 1,
    nodes,
    links,
    genome: nodes.map((item) => item.gene),
    energy: 100,
    age: 0,
    alive: true,
  };
}

function world(subject, viscosity = 0.08) {
  return {
    config: {
      width: WORLD_SIZE,
      height: WORLD_SIZE,
      viscosity,
    },
    creatures: [subject],
    food: [],
    tick: 0,
  };
}

function step(subject, environment, count, beforeStep) {
  for (let index = 0; index < count; index++) {
    if (beforeStep) beforeStep(environment.tick);
    environment.tick++;
    updateCreaturePhysics(subject, environment, 1);
  }
}

function centerOfMass(subject) {
  let totalMass = 0;
  let x = 0;
  let y = 0;

  for (const item of subject.nodes) {
    const mass = item.gene.size ** 2;
    totalMass += mass;
    x += item.x * mass;
    y += item.y * mass;
  }

  return { x: x / totalMass, y: y / totalMass };
}

function angularVelocity(subject, subjectLink) {
  const a = subject.nodes[subjectLink.nodeA];
  const b = subject.nodes[subjectLink.nodeB];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  const perpendicularX = -dy / length;
  const perpendicularY = dx / length;
  const relativeVx = b.vx - a.vx;
  const relativeVy = b.vy - a.vy;

  return (
    relativeVx * perpendicularX + relativeVy * perpendicularY
  ) / length;
}

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

  step(subject, environment, period * 2, driveActuator);
  const initialCenter = centerOfMass(subject);
  step(subject, environment, period, driveActuator);

  const finalCenter = centerOfMass(subject);
  const displacement = Math.hypot(
    finalCenter.x - initialCenter.x,
    finalCenter.y - initialCenter.y,
  );
  assert.ok(displacement < 0.1, `reciprocal stroke traveled ${displacement}`);
});
