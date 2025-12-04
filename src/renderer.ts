import * as THREE from 'three';
import { World, Creature, Node, Food, SegmentType } from './types';

// Colors for node types
const NODE_COLORS: Record<SegmentType, number> = {
  [SegmentType.Neutral]: 0x888888,  // Gray
  [SegmentType.Sucker]: 0xff4444,   // Red
  [SegmentType.Solar]: 0x44ff44,    // Green
  [SegmentType.Mating]: 0xff44ff,   // Pink/Magenta
};

const FOOD_COLOR = 0xffff44; // Yellow
const LINK_COLOR = 0x666666;
const BACKGROUND_COLOR = 0x111122;

export class Renderer {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;

  private nodeMeshes: Map<string, THREE.Mesh> = new Map();
  private linkMeshes: Map<string, THREE.Line> = new Map();
  private foodMeshes: Map<number, THREE.Mesh> = new Map();

  private nodeGeometry: THREE.CircleGeometry;
  private foodGeometry: THREE.CircleGeometry;
  private linkMaterial: THREE.LineBasicMaterial;

  constructor(private width: number, private height: number) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(BACKGROUND_COLOR);

    // Orthographic camera for 2D view
    const aspect = window.innerWidth / window.innerHeight;
    const viewHeight = height;
    const viewWidth = viewHeight * aspect;

    this.camera = new THREE.OrthographicCamera(
      -viewWidth / 2,
      viewWidth / 2,
      viewHeight / 2,
      -viewHeight / 2,
      0.1,
      1000
    );
    this.camera.position.z = 100;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(this.renderer.domElement);

    // Shared geometries
    this.nodeGeometry = new THREE.CircleGeometry(1, 16);
    this.foodGeometry = new THREE.CircleGeometry(1, 8);
    this.linkMaterial = new THREE.LineBasicMaterial({ color: LINK_COLOR });

    // Handle resize
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private onResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    const viewHeight = this.height;
    const viewWidth = viewHeight * aspect;

    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // Sync renderer state with world
  sync(world: World): void {
    const activeNodeKeys = new Set<string>();
    const activeLinkKeys = new Set<string>();
    const activeFoodIds = new Set<number>();

    // Update creatures
    for (const creature of world.creatures) {
      if (!creature.alive) continue;

      // Update nodes
      for (const node of creature.nodes) {
        const key = `c${creature.id}_n${node.id}`;
        activeNodeKeys.add(key);

        let mesh = this.nodeMeshes.get(key);
        if (!mesh) {
          const material = new THREE.MeshBasicMaterial({
            color: NODE_COLORS[node.gene.type],
          });
          mesh = new THREE.Mesh(this.nodeGeometry, material);
          this.scene.add(mesh);
          this.nodeMeshes.set(key, mesh);
        }

        mesh.position.set(node.x, node.y, 0);
        mesh.scale.set(node.gene.size, node.gene.size, 1);

        // Dim based on energy
        const brightness = 0.3 + 0.7 * Math.min(1, creature.energy / 50);
        const baseColor = new THREE.Color(NODE_COLORS[node.gene.type]);
        (mesh.material as THREE.MeshBasicMaterial).color.setRGB(
          baseColor.r * brightness,
          baseColor.g * brightness,
          baseColor.b * brightness
        );
      }

      // Update links
      for (let i = 0; i < creature.links.length; i++) {
        const link = creature.links[i];
        const key = `c${creature.id}_link${i}`;
        activeLinkKeys.add(key);

        const nodeA = creature.nodes[link.nodeA];
        const nodeB = creature.nodes[link.nodeB];
        if (!nodeA || !nodeB) continue;

        let line = this.linkMeshes.get(key);
        if (!line) {
          const geometry = new THREE.BufferGeometry();
          line = new THREE.Line(geometry, this.linkMaterial);
          this.scene.add(line);
          this.linkMeshes.set(key, line);
        }

        const positions = new Float32Array([
          nodeA.x, nodeA.y, -1,
          nodeB.x, nodeB.y, -1,
        ]);
        line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        line.geometry.attributes.position.needsUpdate = true;
      }
    }

    // Update food
    for (const food of world.food) {
      activeFoodIds.add(food.id);

      let mesh = this.foodMeshes.get(food.id);
      if (!mesh) {
        const material = new THREE.MeshBasicMaterial({ color: FOOD_COLOR });
        mesh = new THREE.Mesh(this.foodGeometry, material);
        this.scene.add(mesh);
        this.foodMeshes.set(food.id, mesh);
      }

      mesh.position.set(food.x, food.y, -2);
      mesh.scale.set(food.radius, food.radius, 1);
    }

    // Remove stale meshes
    for (const [key, mesh] of this.nodeMeshes) {
      if (!activeNodeKeys.has(key)) {
        this.scene.remove(mesh);
        (mesh.material as THREE.Material).dispose();
        this.nodeMeshes.delete(key);
      }
    }

    for (const [key, line] of this.linkMeshes) {
      if (!activeLinkKeys.has(key)) {
        this.scene.remove(line);
        line.geometry.dispose();
        this.linkMeshes.delete(key);
      }
    }

    for (const [id, mesh] of this.foodMeshes) {
      if (!activeFoodIds.has(id)) {
        this.scene.remove(mesh);
        (mesh.material as THREE.Material).dispose();
        this.foodMeshes.delete(id);
      }
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  // Get stats for info display
  getStats(world: World): string {
    const aliveCreatures = world.creatures.filter(c => c.alive).length;
    const totalNodes = world.creatures.reduce(
      (sum, c) => sum + (c.alive ? c.nodes.length : 0),
      0
    );
    const totalEnergy = world.creatures.reduce(
      (sum, c) => sum + (c.alive ? c.energy : 0),
      0
    );

    return [
      `Tick: ${world.tick}`,
      `Creatures: ${aliveCreatures}`,
      `Nodes: ${totalNodes}`,
      `Food: ${world.food.length}`,
      `Total Energy: ${totalEnergy.toFixed(0)}`,
    ].join('\n');
  }
}
