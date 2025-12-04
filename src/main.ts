import { createWorld, initializeWorld, step } from './simulation';
import { CollisionSystem } from './collision';
import { Renderer } from './renderer';

// World configuration
const WORLD_WIDTH = 800;
const WORLD_HEIGHT = 600;

// Create world
const world = createWorld({
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  viscosity: 0.08,
  insolation: 0.005,  // Was 0.03
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
      // Simple test: equilateral triangle with one square-wave driven segment
      // Side length s, active segment alternates between 1.5s and 0.75s every 2 seconds
      import('./types').then(({ SegmentType }) => {
        const id = world.nextCreatureId++;
        const cx = 0, cy = 0;
        const s = 40; // side length
        const h = s * Math.sqrt(3) / 2; // height of equilateral triangle

        // Equilateral triangle: node 0 at top, nodes 1,2 at bottom
        const n0 = { id: 0, gene: { type: SegmentType.Neutral, size: 5, links: [], efficiency: 0.5 }, x: cx, y: cy - h * 2/3, vx: 0, vy: 0 };
        const n1 = { id: 1, gene: { type: SegmentType.Neutral, size: 5, links: [], efficiency: 0.5 }, x: cx - s/2, y: cy + h * 1/3, vx: 0, vy: 0 };
        const n2 = { id: 2, gene: { type: SegmentType.Neutral, size: 5, links: [], efficiency: 0.5 }, x: cx + s/2, y: cy + h * 1/3, vx: 0, vy: 0 };

        const nodes = [n0, n1, n2];

        // Links - softer springs so transitions are slower and drag has time to act
        const links = [
          { nodeA: 0, nodeB: 1, restLength: s, stiffness: 0.5, actuationAmp: 0, actuationFreq: 0, actuationPhase: 0 },
          { nodeA: 0, nodeB: 2, restLength: s, stiffness: 0.5, actuationAmp: 0, actuationFreq: 0, actuationPhase: 0 },
          { nodeA: 1, nodeB: 2, restLength: s, stiffness: 0.5, actuationAmp: 0, actuationFreq: 0, actuationPhase: 0 }, // This one we'll drive
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

        // Square wave driver: toggle between 1.5s and 0.75s every 2 seconds
        const baseLength = s;
        let expanded = true;
        const activeLink = creature.links[2];
        activeLink.restLength = baseLength * 1.5; // Start expanded

        setInterval(() => {
          expanded = !expanded;
          activeLink.restLength = expanded ? baseLength * 1.5 : baseLength * 0.75;
          console.log(`Active segment target: ${activeLink.restLength.toFixed(1)} (${expanded ? 'expanded' : 'contracted'})`);
        }, 2000);

        // Log node 0 position periodically
        setInterval(() => {
          const n0 = creature.nodes[0];
          const n1 = creature.nodes[1];
          const n2 = creature.nodes[2];
          const bottomLength = Math.sqrt((n2.x - n1.x) ** 2 + (n2.y - n1.y) ** 2);
          console.log(`Node0 pos: (${n0.x.toFixed(1)}, ${n0.y.toFixed(1)}) vel: (${n0.vx.toFixed(3)}, ${n0.vy.toFixed(3)}) bottom: ${bottomLength.toFixed(1)}`);
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
