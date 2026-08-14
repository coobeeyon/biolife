const test = require('node:test');
const assert = require('node:assert/strict');

const {
  NARROW_HAND_SEPARATION,
  SHORT_ARM_LENGTH,
  advanceStrokeCycle,
  createCanonicalBreaststroke,
} = require('./canonical-breaststroke.cjs');

function warmUp(simulation, cycles = 2) {
  for (let index = 0; index < cycles; index++) {
    advanceStrokeCycle(simulation);
  }
}

function maximumShapeDifference(first, second) {
  return Math.max(...first.map((value, index) => Math.abs(value - second[index])));
}

test('canonical breaststroke closes its shape loop and travels forward repeatably', () => {
  const simulation = createCanonicalBreaststroke();
  warmUp(simulation);
  const samples = [];

  for (let index = 0; index < 4; index++) {
    samples.push(advanceStrokeCycle(simulation));
  }

  const forwardDistances = samples.map((sample) => sample.forward);
  const minimumForward = Math.min(...forwardDistances);
  const maximumForward = Math.max(...forwardDistances);

  assert.ok(minimumForward > 8, `expected forward travel, got ${minimumForward}`);
  assert.ok(maximumForward - minimumForward < 0.001, 'travel changed between cycles');

  for (let index = 0; index < samples.length; index++) {
    const sample = samples[index];
    assert.ok(Math.abs(sample.lateral) < 0.1, `cycle ${index + 1} drifted laterally`);
    assert.ok(Math.abs(sample.yaw) < 0.002, `cycle ${index + 1} accumulated yaw`);
    assert.deepEqual(sample.targetShape, [
      SHORT_ARM_LENGTH,
      SHORT_ARM_LENGTH,
      NARROW_HAND_SEPARATION,
    ]);

    if (index > 0) {
      assert.ok(
        maximumShapeDifference(samples[index - 1].shape, sample.shape) < 0.001,
        `cycle ${index + 1} did not return to the same body-relative shape`,
      );
    }
  }
});

test('reversing the breaststroke shape loop reverses travel', () => {
  const forward = createCanonicalBreaststroke();
  const reverse = createCanonicalBreaststroke({ reverse: true });
  warmUp(forward);
  warmUp(reverse);

  const forwardSample = advanceStrokeCycle(forward);
  const reverseSample = advanceStrokeCycle(reverse);

  assert.ok(forwardSample.forward > 8, `forward loop traveled ${forwardSample.forward}`);
  assert.ok(reverseSample.forward < -8, `reverse loop traveled ${reverseSample.forward}`);
});

test('breaststroke displacement converges as the timestep shrinks', () => {
  const timesteps = [1, 0.5, 0.25];
  const distances = timesteps.map((dt) => {
    const simulation = createCanonicalBreaststroke({ dt });
    warmUp(simulation);
    return advanceStrokeCycle(simulation).forward;
  });
  const coarseDifference = Math.abs(distances[0] - distances[1]);
  const fineDifference = Math.abs(distances[1] - distances[2]);
  const relativeRange = (Math.max(...distances) - Math.min(...distances)) /
    Math.max(...distances);

  assert.ok(distances.every((distance) => distance > 8));
  assert.ok(
    fineDifference < coarseDifference,
    `refinement did not converge: ${distances.join(', ')}`,
  );
  assert.ok(relativeRange < 0.03, `timestep spread was ${relativeRange}`);
});
