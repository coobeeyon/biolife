import { createWorld, initializeWorld, step } from './simulation';
import { CollisionSystem } from './collision';
import { Renderer } from './renderer';

// World configuration
const WORLD_WIDTH = 2400;
const WORLD_HEIGHT = 1800;

// Create world
const world = createWorld({
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  viscosity: 0.08,
  insolation: 0.0015,  // Half of 0.005
  foodSpawnRate: 0.02,  // Was 0.15 - reduced to ~1 food per second at 60fps
  foodEnergy: 15,       // Was 25
  matingEnergyCost: 80,
  matingEnergyThreshold: 70,
  divisionEnergyThreshold: 150,
  mutationRate: 0.12,
  mutationStrength: 0.25,
});

// Initialize systems
const collisionSystem = new CollisionSystem();
const renderer = new Renderer(WORLD_WIDTH, WORLD_HEIGHT);

// Initialize world with creatures and food
initializeWorld(world, 15, 80);

// Info display
const infoElement = document.getElementById('info')!;

// Simulation control
let running = true;
let lastTime = performance.now();
const targetDt = 1000 / 60; // 60 fps target

function gameLoop(currentTime: number): void {
  if (running) {
    const elapsed = currentTime - lastTime;

    // Run simulation steps to catch up
    if (elapsed >= targetDt) {
      const steps = Math.min(Math.floor(elapsed / targetDt), 3); // Cap at 3 steps to prevent spiral
      for (let i = 0; i < steps; i++) {
        step(world, collisionSystem, 1);
      }
      lastTime = currentTime - (elapsed % targetDt);
    }

    // Sync renderer and render
    renderer.sync(world);
    renderer.render();

    // Update info display
    infoElement.textContent = renderer.getStats(world);
  }

  requestAnimationFrame(gameLoop);
}

// Start the loop
requestAnimationFrame(gameLoop);

// Keyboard controls
document.addEventListener('keydown', (e) => {
  switch (e.key) {
    case ' ':
      running = !running;
      break;
    case 'f':
      // Spawn food at center
      import('./simulation').then(({ spawnFood }) => {
        for (let i = 0; i < 10; i++) {
          spawnFood(world);
        }
      });
      break;
    case 'c':
      // Simple 3-node fish that glides when given initial velocity
      // Head on left, two tail nodes on right
      import('./types').then(({ SegmentType }) => {
        const id = 99;  // Fixed ID for debug logging
        world.nextCreatureId = Math.max(world.nextCreatureId, 100);
        const cx = 0, cy = 0;

        // Fish starting at rest
        // Head on left, tail nodes spread at ~90 degrees total (45 each side)
        const legLength = 60;
        const halfAngle = 45 * Math.PI / 180;  // 45 degrees each side = 90 degree spread
        const tailX = cx + legLength * Math.cos(halfAngle);
        const tailY = legLength * Math.sin(halfAngle);

        const n0 = { id: 0, gene: { type: SegmentType.Neutral, size: 12, links: [], efficiency: 0.5 }, x: cx, y: cy, vx: 0, vy: 0 };
        const n1 = { id: 1, gene: { type: SegmentType.Neutral, size: 4, links: [], efficiency: 0.5 }, x: tailX, y: -tailY, vx: 0, vy: 0 };
        const n2 = { id: 2, gene: { type: SegmentType.Neutral, size: 4, links: [], efficiency: 0.5 }, x: tailX, y: tailY, vx: 0, vy: 0 };

        const nodes = [n0, n1, n2];

        // Initial tail spread for 160 degrees
        const initialTailSpread = 2 * tailY;

        const links = [
          { nodeA: 0, nodeB: 1, restLength: legLength, stiffness: 0.5, actuationAmp: 0, actuationFreq: 0, actuationPhase: 0 },
          { nodeA: 0, nodeB: 2, restLength: legLength, stiffness: 0.5, actuationAmp: 0, actuationFreq: 0, actuationPhase: 0 },
          { nodeA: 1, nodeB: 2, restLength: initialTailSpread, stiffness: 0.5, actuationAmp: 0, actuationFreq: 0, actuationPhase: 0 },
        ];

        const creature = {
          id,
          nodes,
          links,
          genome: nodes.map(n => n.gene),
          energy: 100,
          age: 0,
          alive: true,
        };
        world.creatures.push(creature);

        // Swimming stroke - a LOOP in configuration space
        // Two degrees of freedom: tail spread (link 2) and leg length (links 0,1)
        const tailLink = creature.links[2];  // Between tail nodes
        const legLinkA = creature.links[0];  // Head to tail-top
        const legLinkB = creature.links[1];  // Head to tail-bottom

        // Swim cycle parameters
        // Big: 3x longer than small
        // Small: legs=30, tail=25
        // Big: legs=90, tail=75
        const legsShort = 30;
        const legsLong = 180;   // 3x longer
        const tailClosed = 25;
        const tailOpen = 180;   // 3x wider

        const stepTime = 1500;  // ms per phase - very slow

        function swimCycle() {
          // Phase 1: Close tail (legs still long)
          tailLink.restLength = tailClosed;
          console.log('1. CLOSE TAIL (legs long)');

          setTimeout(() => {
            // Phase 2: Shorten legs (tail still closed)
            legLinkA.restLength = legsShort;
            legLinkB.restLength = legsShort;
            console.log('2. SHORTEN LEGS (tail closed)');

            setTimeout(() => {
              // Phase 3: Open tail (legs still short)
              tailLink.restLength = tailOpen;
              legLinkA.restLength = legsShort * 3;
              legLinkB.restLength = legsShort * 3;
              console.log('3. OPEN TAIL (legs short)');

              setTimeout(() => {
                // Phase 4: Lengthen legs (tail still open)
                legLinkA.restLength = legsLong;
                legLinkB.restLength = legsLong;
                console.log('4. LENGTHEN LEGS (tail open)');

                setTimeout(() => {
                  // Repeat the cycle
                  swimCycle();
                }, stepTime);
              }, stepTime);
            }, stepTime);
          }, stepTime);
        }

        // Initialize to starting config and begin
        tailLink.restLength = tailOpen;
        legLinkA.restLength = legsLong;
        legLinkB.restLength = legsLong;
        setTimeout(swimCycle, 500);

        // Log head position
        setInterval(() => {
          const head = creature.nodes[0];
          console.log(`Head pos: (${head.x.toFixed(1)}, ${head.y.toFixed(1)}) vel: (${head.vx.toFixed(3)}, ${head.vy.toFixed(3)})`);
        }, 500);
      });
      break;
  }
});

// Log controls
console.log('BioLife Simulation Controls:');
console.log('  Space - Pause/Resume');
console.log('  F - Spawn 10 food particles');
console.log('  C - Spawn a new creature');
