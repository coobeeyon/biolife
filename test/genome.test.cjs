const test = require('node:test');
const assert = require('node:assert/strict');

const { createCreature } = require('../node_modules/.cache/biolife-tests/creature.js');
const {
  MAX_GAIT_AMPLITUDE,
  MAX_GAIT_FREQUENCY,
  crossover,
  mutate,
  parseGenome,
  serializeGenome,
} = require('../node_modules/.cache/biolife-tests/genome.js');

const inheritedGenome = [
  { type: 'neutral', size: 8, efficiency: 0.5, links: [] },
  {
    type: 'solar',
    size: 5,
    efficiency: 0.7,
    links: [-1],
    linkGaits: {
      '-1': { amplitude: 0.35, frequency: 1.75, phase: Math.PI / 3 },
    },
  },
];

function withRandom(random, action) {
  const original = Math.random;
  Math.random = random;
  try {
    return action();
  } finally {
    Math.random = original;
  }
}

test('an unmutated offspring inherits its parent gait', () => {
  const childGenome = mutate(inheritedGenome, 0, 1);

  assert.deepEqual(childGenome, inheritedGenome);
  assert.notEqual(childGenome, inheritedGenome);
  assert.notEqual(childGenome[1].linkGaits, inheritedGenome[1].linkGaits);

  const parent = withRandom(() => 0.1, () => createCreature(1, inheritedGenome, 0, 0, 50));
  const child = withRandom(() => 0.9, () => createCreature(2, childGenome, 0, 0, 50));

  assert.deepEqual(
    {
      amplitude: child.links[0].actuationAmp,
      frequency: child.links[0].actuationFreq,
      phase: child.links[0].actuationPhase,
    },
    inheritedGenome[1].linkGaits['-1'],
  );
  assert.deepEqual(
    child.links.map(({ actuationAmp, actuationFreq, actuationPhase }) => ({
      actuationAmp,
      actuationFreq,
      actuationPhase,
    })),
    parent.links.map(({ actuationAmp, actuationFreq, actuationPhase }) => ({
      actuationAmp,
      actuationFreq,
      actuationPhase,
    })),
  );
});

test('genome strings round-trip inherited gaits and legacy passive links', () => {
  const serialized = serializeGenome(inheritedGenome);
  const parsed = parseGenome(serialized);

  assert.match(serialized, /-1@0\.350:1\.750:1\.0472/);
  assert.deepEqual(parsed, [
    { type: 'neutral', size: 8, efficiency: 0.5, links: [] },
    {
      type: 'solar',
      size: 5,
      efficiency: 0.7,
      links: [-1],
      linkGaits: {
        '-1': { amplitude: 0.35, frequency: 1.75, phase: 1.0472 },
      },
    },
  ]);

  assert.deepEqual(parseGenome('(neutral,5,0.5,-1,+2)'), [
    { type: 'neutral', size: 5, efficiency: 0.5, links: [-1, 2] },
  ]);
});

test('crossover copies gait genes instead of sharing them with a parent', () => {
  const child = withRandom(() => 0.99, () => crossover(inheritedGenome, inheritedGenome));

  assert.deepEqual(child, inheritedGenome);
  assert.notEqual(child[1].linkGaits, inheritedGenome[1].linkGaits);
  child[1].linkGaits['-1'].amplitude = 0;
  assert.equal(inheritedGenome[1].linkGaits['-1'].amplitude, 0.35);
});

test('gait mutation remains bounded even at extreme mutation strength', () => {
  let state = 0x1a2b3c4d;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  let observedGaits = 0;

  withRandom(random, () => {
    for (let iteration = 0; iteration < 50; iteration++) {
      const result = mutate(inheritedGenome, 0.9, 100);
      for (const gene of result) {
        for (const gait of Object.values(gene.linkGaits ?? {})) {
          observedGaits++;
          assert.ok(gait.amplitude >= 0 && gait.amplitude <= MAX_GAIT_AMPLITUDE);
          assert.ok(gait.frequency >= 0 && gait.frequency <= MAX_GAIT_FREQUENCY);
          assert.ok(gait.phase >= 0 && gait.phase < Math.PI * 2);
        }
      }
    }
  });

  assert.ok(observedGaits > 0);
});
