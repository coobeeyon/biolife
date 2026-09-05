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
    energy: 1_000_000,
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

function step(subject, environment, count, options = {}) {
  const { beforeStep, dt = 1 } = options;

  for (let index = 0; index < count; index++) {
    if (beforeStep) beforeStep(environment.tick * dt);
    environment.tick++;
    updateCreaturePhysics(subject, environment, dt);
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

function distance(subject, nodeA, nodeB) {
  const a = subject.nodes[nodeA];
  const b = subject.nodes[nodeB];
  return Math.hypot(b.x - a.x, b.y - a.y);
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

module.exports = {
  angularVelocity,
  centerOfMass,
  creature,
  distance,
  link,
  node,
  step,
  world,
};
