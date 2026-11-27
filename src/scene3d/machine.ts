import {
  AmbientLight, BoxGeometry, CanvasTexture, Color, CylinderGeometry, DirectionalLight, Group,
  Mesh, MeshBasicMaterial, MeshStandardMaterial, OrthographicCamera, PlaneGeometry, Scene,
  SRGBColorSpace, Texture, WebGLRenderer, type BufferGeometry, type Material,
} from 'three';
import { keyboardRows, type ModelId } from '../engine/models/service';

interface Snapshot {
  modelId: ModelId;
  positions: readonly string[];
  before: readonly string[];
  input?: string;
  output?: string;
  accent: string;
}

export interface MachineScene {
  update(snapshot: Snapshot): void;
  setKeys(input?: string, output?: string): void;
  explode(value: boolean): void;
  rotate(direction: number): void;
  reset(): void;
  dispose(): void;
}

const TAU = 2 * Math.PI;
const DEFAULT_YAW = -0.43;
const DEFAULT_PITCH = 0.66;

function texture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const map = new CanvasTexture(canvas);
  map.colorSpace = SRGBColorSpace;
  return map;
}

function ink(text: string, width = 128, height = 128, color = '#f1dfb5') {
  return texture(width, height, (ctx) => {
    ctx.fillStyle = color;
    ctx.font = '600 ' + Math.floor(height * 0.64) + 'px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height * 0.52);
  });
}

function surface(color: string, metalness = 0, roughness = 0.7) {
  return new MeshStandardMaterial({ color, metalness, roughness });
}

function box(parent: Group, material: Material, x: number, y: number, z: number, w: number, h: number, d: number) {
  return part(parent, new BoxGeometry(w, h, d), material, x, y, z);
}
function part(parent: Group, geometry: BufferGeometry, material: Material, x: number, y: number, z: number) {
  const mesh = new Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
function cylinder(parent: Group, material: Material, x: number, y: number, z: number, radius: number, width: number) {
  return part(parent, new CylinderGeometry(radius, radius, width, 32), material, x, y, z);
}
function across(parent: Group, material: Material, x: number, radius: number, width: number) {
  const wheel = cylinder(parent, material, x, 0, 0, radius, width);
  wheel.rotation.z = Math.PI / 2;
  return wheel;
}

export function createMachineScene(canvas: HTMLCanvasElement): MachineScene | null {
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!context) return null;
  const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));

  const scene = new Scene();
  const camera = new OrthographicCamera(-4, 4, 3, -3, 0.1, 45);
  const machine = new Group();
  scene.add(machine);
  scene.add(new AmbientLight('#bed2d1', 1.4));
  const warm = new DirectionalLight('#ffe5be', 2.45);
  warm.position.set(-3, 7, 4.5);
  const cool = new DirectionalLight('#9fb8a8', 1.35);
  cool.position.set(5, 3, -4);
  scene.add(warm, cool);

  const wood = surface('#74482d', 0, 0.81);
  const woodDark = surface('#4b2f22');
  const woodTrim = surface('#9d6742');
  const steel = surface('#29352e', 0.31, 0.64);
  const black = surface('#141c18', 0.23, 0.69);
  const brass = surface('#ab8450', 0.40, 0.44);
  const rim = surface('#8c7957', 0.35, 0.51);
  const hub = surface('#747e73', 0.39, 0.58);
  const lampOff = surface('#595d42');
  const keyTop = surface('#252b22');
  const accent = new Color('#ebbe78');
  const hot = new MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.56, roughness: 0.44 });

  const shadowMap = texture(128, 128, (ctx) => {
    const gradient = ctx.createRadialGradient(64, 64, 7, 64, 64, 62);
    gradient.addColorStop(0, 'rgba(0,0,0,.72)');
    gradient.addColorStop(0.65, 'rgba(0,0,0,.43)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
  });
  const shadow = part(machine, new PlaneGeometry(8.6, 7), new MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false }), 0, -0.62, 0.08);
  shadow.rotateX(-Math.PI / 2);

  box(machine, woodDark, 0, -0.51, 0, 5.47, 0.20, 4.96);
  box(machine, wood, 0, -0.25, 0, 5.41, 0.44, 4.90);
  box(machine, steel, 0, 0.02, 0, 5.17, 0.21, 4.62);
  for (const edge of [-1, 1]) {
    box(machine, woodTrim, edge * 2.65, 0.09, 0, 0.11, 0.19, 4.88);
    box(machine, woodTrim, 0, 0.09, edge * 2.37, 5.40, 0.19, 0.13);
    box(machine, brass, edge * 2.15, -0.18, 2.47, 0.23, 0.28, 0.06);
    box(machine, brass, edge * 2.12, 0.19, -2.37, 0.22, 0.13, 0.22);
  }
  box(machine, woodTrim, 0, -0.47, 2.459, 5.35, 0.035, 0.023);
  box(machine, black, 0, -0.13, 2.469, 2.94, 0.35, 0.042);
  for (let i = 0; i < 13; i += 1) {
    for (const y of [-0.06, -0.19]) {
      const port = cylinder(machine, i % 4 === 0 ? rim : steel, (i - 6) * 0.204, y, 2.50, 0.040, 0.024);
      port.rotation.x = Math.PI / 2;
    }
  }

  const lid = new Group();
  machine.add(lid);
  lid.position.set(0, 0.18, -2.35);
  lid.rotation.x = -0.34;
  box(lid, woodDark, 0, 1.19, 0, 5.44, 2.38, 0.18);
  box(lid, wood, 0, 1.19, 0.09, 5.20, 2.15, 0.10);
  for (const edge of [-1, 1]) {
    box(lid, woodTrim, edge * 2.52, 1.19, 0.16, 0.09, 2.2, 0.045);
    box(lid, woodTrim, 0, 1.19 + edge * 1.05, 0.16, 5.08, 0.07, 0.045);
    for (const y of [0.19, 2.18]) {
      const screw = cylinder(lid, brass, edge * 2.50, y, 0.198, 0.025, 0.012);
      screw.rotation.x = Math.PI / 2;
    }
  }
  box(lid, rim, 0, 1.33, 0.16, 1.76, 0.36, 0.040);
  part(lid, new PlaneGeometry(1.45, 0.20), new MeshBasicMaterial({ map: ink('E N I G M A', 384, 64), transparent: true, depthWrite: false }), 0, 1.33, 0.184);

  const keys = new Group();
  const lamps = new Group();
  machine.add(keys, lamps);
  box(keys, black, 0, 0.17, 1.36, 4.83, 0.14, 1.65);
  box(lamps, steel, 0, 0.18, -0.22, 4.83, 0.15, 1.50);
  const faces = new Map<string, {
    key: Group; cap: Mesh; bulb: Mesh; keyLabel: Mesh; lampLabel: Mesh;
    glyph: MeshBasicMaterial; activeGlyph: MeshBasicMaterial;
  }>();
  for (const [rowIndex, row] of keyboardRows.entries()) {
    for (const [column, letter] of [...row].entries()) {
      const x = (column - (row.length - 1) / 2) * 0.45;
      const key = new Group();
      keys.add(key);
      key.position.set(x, 0, 0.93 + rowIndex * 0.45);
      cylinder(key, rim, 0, 0.278, 0, 0.160, 0.082);
      const cap = cylinder(key, keyTop, 0, 0.323, 0, 0.127, 0.022);
      const glyph = new MeshBasicMaterial({
        map: ink(letter, 128, 128, '#fff'), color: '#f1dfb5', transparent: true, depthWrite: false,
      });
      const activeGlyph = glyph.clone();
      activeGlyph.color.set('#211b13');
      const keyLabel = part(key, new PlaneGeometry(0.205, 0.205), glyph, 0, 0.336, 0);
      keyLabel.rotateX(-Math.PI / 2);

      const z = -0.57 + rowIndex * 0.37;
      cylinder(lamps, rim, x, 0.261, z, 0.146, 0.037);
      const bulb = cylinder(lamps, lampOff, x, 0.282, z, 0.113, 0.019);
      const lampLabel = part(lamps, new PlaneGeometry(0.207, 0.207), glyph, x, 0.294, z);
      lampLabel.rotateX(-Math.PI / 2);
      faces.set(letter, { key, cap, bulb, keyLabel, lampLabel, glyph, activeGlyph });
    }
  }

  const wheelBank = new Group();
  machine.add(wheelBank);
  box(machine, black, 0, 0.15, -1.48, 4.81, 0.16, 0.89);
  const axis = across(wheelBank, hub, 0, 0.10, 4.22);
  const endLeft = across(wheelBank, steel, -1.93, 0.44, 0.24);
  const endRight = across(wheelBank, hub, 1.93, 0.36, 0.22);
  const wheelGroups = Array.from({ length: 4 }, (_, slot) => {
    const assembly = new Group();
    const rotor = new Group();
    wheelBank.add(assembly);
    assembly.add(rotor);
    const regular = across(rotor, brass, 0, 0.48, 0.49);
    const slim = across(rotor, brass, 0, 0.47, 0.27);
    const gear = new Group();
    rotor.add(gear);
    for (let tooth = 0; tooth < 26; tooth += 1) {
      const phase = TAU * tooth / 26;
      const piece = box(gear, rim, 0, 0.49 * Math.cos(phase), 0.49 * Math.sin(phase), 0.50, 0.095, 0.070);
      piece.rotateX(phase);
    }
    across(rotor, rim, 0, 0.23, 0.53);
    const badge = new Group();
    assembly.add(badge);
    badge.position.set(0, 0.48, 0.31);
    badge.rotation.x = -Math.PI / 2 + 0.22;
    box(badge, black, 0, 0, 0, 0.32, 0.24, 0.026);
    const material = new MeshBasicMaterial({ transparent: true, depthWrite: false });
    part(badge, new PlaneGeometry(0.28, 0.18), material, 0, 0, 0.016);
    return { slot, assembly, rotor, gear, regular, slim, material };
  });
  const positionTextures = new Map<string, CanvasTexture>();

  let yaw = DEFAULT_YAW;
  let pitch = DEFAULT_PITCH;
  let frame = 0;
  let exploded = false;
  let separation = 0;
  let separationFrom = 0;
  let explodeStart = 0;
  let rotationStart = 0;
  let state: Snapshot | null = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const elapsed = (start: number, now: number, duration: number) =>
    start && !reduced.matches ? Math.min(1, Math.max(0, (now - start) / duration)) : 1;
  const ease = (p: number) => 1 - (1 - p) ** 3;

  function schedule() {
    if (!frame) frame = requestAnimationFrame(render);
  }
  function render(now: number) {
    frame = 0;
    const explodeProgress = elapsed(explodeStart, now, 440);
    const rotorProgress = elapsed(rotationStart, now, 260);
    separation = separationFrom + (Number(exploded) - separationFrom) * ease(explodeProgress);
    keys.position.y = 0.41 * separation;
    lamps.position.y = 0.29 * separation;
    wheelBank.position.set(0, 0.57 + separation * 1.56, -1.57 + separation * 0.19);
    axis.scale.y = 1 + separation * 0.10;
    endLeft.position.x = -1.93 - separation * 0.20;
    endRight.position.x = 1.93 + separation * 0.20;
    if (state) {
      const { positions, before } = state;
      const wide = positions.length === 4;
      const spacing = (wide ? 0.88 : 1.02) + 0.12 * separation;
      for (const { slot, assembly, rotor } of wheelGroups) {
        const value = positions[slot];
        if (!value) continue;
        assembly.position.x = (slot - (positions.length - 1) / 2) * spacing;
        const turns = value.charCodeAt(0) - 65;
        rotor.rotation.x = (turns - (before[slot] !== value ? 1 - ease(rotorProgress) : 0)) * TAU / 26;
      }
    }
    const moment = 1 - ease(rotorProgress);
    for (const [letter, { key, cap, bulb, keyLabel, lampLabel, glyph, activeGlyph }] of faces) {
      const pressed = state?.input === letter;
      const lit = state?.output === letter;
      key.position.y = pressed ? -(0.028 + 0.063 * moment) : 0;
      cap.material = pressed ? hot : keyTop;
      keyLabel.material = pressed ? activeGlyph : glyph;
      bulb.material = lit ? hot : lampOff;
      lampLabel.material = lit ? activeGlyph : glyph;
    }

    const radius = 11;
    const lookAtY = 0.72 + 0.29 * separation;
    camera.position.set(radius * Math.sin(yaw) * Math.cos(pitch), radius * Math.sin(pitch) + lookAtY, radius * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(0, lookAtY, 0);
    renderer.render(scene, camera);
    if (explodeProgress < 1 || rotorProgress < 1) schedule();
  }

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    const half = Math.max(3.79, 3.98 / aspect);
    camera.top = half;
    camera.bottom = -half;
    camera.left = -half * aspect;
    camera.right = half * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    schedule();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  const events = new AbortController();
  const options = { signal: events.signal };
  reduced.addEventListener('change', schedule, options);

  let pointer: { id: number; x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (event) => {
    if (pointer || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }, options);
  canvas.addEventListener('pointermove', (event) => {
    if (pointer?.id !== event.pointerId) return;
    yaw += (event.clientX - pointer.x) * 0.012;
    pitch = Math.max(0.40, Math.min(1.12, pitch + (event.clientY - pointer.y) * 0.008));
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    schedule();
  }, options);
  canvas.addEventListener('lostpointercapture', () => { pointer = null; }, options);

  resize();
  return {
    update(snapshot) {
      state = snapshot;
      accent.set(snapshot.accent);
      hot.color.copy(accent);
      hot.emissive.copy(accent);
      rotationStart = snapshot.before.some((value, i) => value !== snapshot.positions[i]) ? performance.now() : 0;
      for (const { slot, assembly, gear, regular, slim, material } of wheelGroups) {
        assembly.visible = slot < snapshot.positions.length;
        if (!assembly.visible) continue;
        const isGreek = snapshot.modelId === 'M4' && slot === 0;
        regular.visible = !isGreek;
        slim.visible = isGreek;
        gear.scale.x = isGreek ? 0.6 : 1;
        const value = snapshot.positions[slot];
        const label = snapshot.modelId === 'I' ? String(value.charCodeAt(0) - 64).padStart(2, '0') : value;
        if (!positionTextures.has(label)) positionTextures.set(label, ink(label));
        const nextMap = positionTextures.get(label)!;
        if (material.map !== nextMap) {
          material.map = nextMap;
          material.needsUpdate = true;
        }
      }
      schedule();
    },
    setKeys(input, output) {
      if (state) state = { ...state, input, output };
      schedule();
    },
    explode(value) {
      separationFrom = separation;
      exploded = value;
      explodeStart = performance.now();
      schedule();
    },
    rotate(direction) { yaw += direction * 0.40; schedule(); },
    reset() { yaw = DEFAULT_YAW; pitch = DEFAULT_PITCH; schedule(); },
    dispose() {
      if (events.signal.aborted) return;
      events.abort();
      observer.disconnect();
      cancelAnimationFrame(frame);
      if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
      pointer = null;

      const geometries = new Set<BufferGeometry>();
      const materials = new Set<Material>([hot, keyTop, lampOff]);
      const textures = new Set<Texture>(positionTextures.values());
      for (const { glyph, activeGlyph } of faces.values()) materials.add(glyph).add(activeGlyph);
      scene.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        geometries.add(object.geometry);
        for (const material of [object.material].flat()) materials.add(material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) {
        if ('map' in material && material.map instanceof Texture) textures.add(material.map);
        material.dispose();
      }
      for (const map of textures) map.dispose();
      renderer.dispose();
    },
  };
}
