import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

// inline 3d models - each .model-slot draws right on the card thru ONE shared
// canvas (a scissor rect per slot, browsers only allow a few webgl contexts).
// expanding = the slot just grows nd the model grows with it. glbs r meshopt
// compressed so the decoder has to be registered.

/* ----- model registry ----- */

// focus = the node the camera frames. some models have stray label geo far
// frm the body tht wud blow up the bounding box
const MODELS = {
  'circulatory-system': {
    url: '/assets/models/circulatory-system.glb',
    focus: 'circulatory_system',
    // this labels text exported with 0 y scale so it draws as an empty grey pill
    hide: ['LabelGroup4012'],
    // standing figure, leave a lil room for the labels beside it
    fitOffset: 1.06,
    autoplay: false,
  },
  'beating-heart': {
    url: '/assets/models/beating-heart.glb',
    // labels off for now
    /*
    // at = a point in the models own space, grabbed by clicking with ?pick on
    // - real surface hits not guesses
    labels: [
      {
        text: 'Aorta',
        at: [-0.001, 0.156, 0.01],
        facing: [0.141, 0.469, 0.872],
        info: 'The main artery leaving the heart. Carries oxygenated blood from the left ventricle out to the rest of the body.',
      },
      {
        text: 'Superior vena cava',
        at: [-0.038, 0.143, 0.005],
        facing: [-0.429, 0.08, 0.9],
        info: 'Returns deoxygenated blood from the head and upper body into the right atrium.',
      },
      {
        text: 'Pulmonary artery',
        at: [0.033, 0.141, 0.008],
        facing: [0.487, 0.123, 0.865],
        info: 'Carries deoxygenated blood from the right ventricle to the lungs - the one artery that does not carry oxygenated blood.',
      },
      {
        text: 'Right atrium',
        at: [-0.045, 0.101, -0.005],
        facing: [0.866, -0.465, 0.186],
        info: 'Receives deoxygenated blood returning from the body.',
      },
      {
        text: 'Left atrium',
        at: [0.02, 0.108, -0.024],
        facing: [0.358, -0.666, 0.655],
        info: 'Receives oxygenated blood from the lungs.',
      },
      {
        text: 'Right ventricle',
        at: [-0.022, 0.041, 0.012],
        facing: [0.249, 0.125, 0.96],
        info: 'Pumps deoxygenated blood to the lungs.',
      },
      {
        text: 'Left ventricle',
        at: [0.035, 0.048, -0.002],
        facing: [-0.451, 0.389, 0.803],
        info: 'Pumps oxygenated blood to the body through the aorta. Its wall is the thickest in the heart, because it pushes blood the furthest.',
      },
      {
        text: 'Septum',
        at: [0.012, 0.038, 0.021],
        facing: [0.022, 0.027, 0.999],
        info: 'Thick wall of muscle separating the left and right sides, so oxygenated and deoxygenated blood never mix.',
      },
    ],
    */
    fitOffset: 1.06,
    // exported with full emissive which washes the muscle out to flat pink
    emissiveIntensity: 0.25,
    autoplay: true,
  },
  'heart-lungs': {
    url: '/assets/models/heart-lungs.glb',
    // labels off for now
    /*
    labels: [
      {
        text: 'Larynx',
        at: [0.003, 0.08, 0.014],
        facing: [0.55, -0.245, 0.798],
        info: 'The voice box, sitting at the top of the airway.',
      },
      {
        text: 'Trachea',
        at: [-0.001, 0.051, 0.003],
        facing: [-0.133, -0.193, 0.972],
        info: 'The windpipe. Carries air from the throat down towards the lungs.',
      },
      {
        text: 'Bronchi',
        at: [-0.004, 0.02, -0.007],
        facing: [0.356, -0.511, 0.782],
        info: 'The trachea splits into two bronchi, one per lung, which branch again and again into narrower bronchioles.',
      },
      {
        text: 'Right lung',
        at: [-0.033, 0.031, -0.001],
        facing: [-0.636, 0.541, 0.55],
        info: 'At the end of the smallest branches sit the alveoli - tiny air sacs wrapped in capillaries, where gas exchange actually happens.',
      },
      {
        text: 'Left lung',
        at: [0.034, 0.03, -0.002],
        facing: [0.443, 0.512, 0.736],
        info: 'Slightly smaller than the right lung, to leave room for the heart.',
      },
      {
        text: 'Heart',
        at: [0.006, -0.012, 0.015],
        facing: [-0.14, 0.523, 0.841],
        info: 'Sits between the lungs. The right side pumps blood to the lungs to collect oxygen; the left side pumps it out to the body.',
      },
      {
        text: 'Diaphragm',
        at: [-0.024, -0.055, 0.023],
        facing: [-0.246, -0.026, 0.969],
        info: 'A sheet of muscle under the lungs. It flattens to pull air in and relaxes to push air back out.',
      },
    ],
    */
    // breathing clip is morph targets which measuring cant see, so extra
    // padding for the model to breathe into
    fitOffset: 1.14,
    autoplay: true,
  },
};


const PREFERS_REDUCED_MOTION = window.matchMedia(
  '(prefers-reduced-motion: reduce)'
).matches;

// ?pick = placement helper, click a model nd it logs the point u hit
const PICK_MODE = new URLSearchParams(location.search).has('pick');

/* ----- shared state ----- */

let renderer, canvas, timer, environment;
let loaderInstance = null;

const slots = [];
const modelCache = new Map(); // key -> { scene, animations }
const pending = new Map(); // key -> in-flight load promise

let expanded = null; // the slot currently filling the screen
let growing = false; // true while an expand animation is still running
let growTimer = null;
let expandedLabels = []; // [{ anchor, el }] built only while expanded

const chrome = {}; // the expanded-mode UI elements

const expandedState = {
  autoRotate: false,
  wireframe: false,
  animationPlaying: true,
  labelsVisible: true,
};

/* ----- renderer ----- */

function initRenderer() {
  canvas = document.getElementById('sceneCanvas');

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true, // transparent, so slots blend into whatever card they sit on
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearAlpha(0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setScissorTest(true);

  // env map made once nd shared by every slot - without it these pbr models
  // look like flat plastic
  const pmrem = new THREE.PMREMGenerator(renderer);
  environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  timer = new THREE.Timer();
  timer.connect(document);

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  if (!renderer) return;
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function getLoader() {
  if (!loaderInstance) {
    loaderInstance = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  }
  return loaderInstance;
}

/* ----- loading ----- */

// fetch nd parse each model once no matter how many slots want it - copies
// share the geometry/textures
function loadSource(key, onProgress) {
  if (modelCache.has(key)) return Promise.resolve(modelCache.get(key));
  if (pending.has(key)) return pending.get(key);

  const config = MODELS[key];
  const request = new Promise((resolve, reject) => {
    getLoader().load(
      config.url,
      (gltf) => {
        // loader gives the scene back without world matrices - settle them
        // once so clones dont copy stale ones
        gltf.scene.updateMatrixWorld(true);

        const entry = { scene: gltf.scene, animations: gltf.animations || [] };
        modelCache.set(key, entry);
        pending.delete(key);
        resolve(entry);
      },
      onProgress,
      (error) => {
        pending.delete(key);
        reject(error);
      }
    );
  });

  pending.set(key, request);
  return request;
}

// SkeletonUtils.clone not a plain clone - a plain one leaves every copy bound
// to the og skeleton so theyd all beat in sync
function instantiate(key, source) {
  const root = cloneSkinned(source.scene);
  const config = MODELS[key];

  if (config.emissiveIntensity !== undefined) {
    root.traverse((obj) => {
      if (!obj.isMesh) return;
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => {
        if (m && m.emissive) m.emissiveIntensity = config.emissiveIntensity;
      });
    });
  }

  return root;
}

/* ----- measuring nd framing ----- */

// box of everything still visible. cant use Box3.setFromObject - it ignores
// visible=false nd uses the bind pose for skinned meshes (the heart is authored
// tiny nd blown up by its bones, the naive box puts the camera inside it)
function boxOfVisible(object, box = new THREE.Box3()) {
  const meshBox = new THREE.Box3();
  box.makeEmpty();

  // updateMatrixWorld not updateWorldMatrix - only this one refreshes the
  // skinned meshes bindMatrixInverse, skip it nd the box comes out 100x too small
  object.updateWorldMatrix(true, false); // parents first
  object.updateMatrixWorld(true);
  object.traverse((child) => {
    if (!child.visible || !child.geometry) return;

    // a hidden ancestor hides everything under it, traverse doesnt kno tht
    for (let p = child.parent; p && p !== object.parent; p = p.parent) {
      if (!p.visible) return;
    }

    if (child.isSkinnedMesh) {
      child.computeBoundingBox();
      meshBox.copy(child.boundingBox);
    } else {
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
      meshBox.copy(child.geometry.boundingBox);
    }

    box.union(meshBox.applyMatrix4(child.matrixWorld));
  });

  return box;
}

// hide the junk baked into the exports - stray geo far frm the focus node
// (wud balloon the bounding box) plus the named duds in hide[]
function prepareVisibility(root, config) {
  root.children.forEach((child) => {
    child.visible = true;
  });

  const subject = config.focus && root.getObjectByName(config.focus);
  if (subject) {
    const focusBox = new THREE.Box3().setFromObject(subject);
    const size = focusBox.getSize(new THREE.Vector3());
    const allowed = focusBox.expandByScalar(
      Math.max(size.x, size.y, size.z) * 0.25
    );
    const center = new THREE.Vector3();

    root.children.forEach((child) => {
      const box = new THREE.Box3().setFromObject(child);
      if (box.isEmpty()) return;
      if (!allowed.containsPoint(box.getCenter(center))) child.visible = false;
    });
  }

  (config.hide || []).forEach((name) => {
    const node = root.getObjectByName(name);
    if (node) node.visible = false;
  });
}

// measure nd recentre the model. for animated ones the box is a union of poses
// across the clip - fitting the resting pose alone crops the heart when it beats
function measureSlot(slot) {
  const { root, config, mixer } = slot;

  root.position.set(0, 0, 0);
  prepareVisibility(root, config);

  // stale bounding spheres can cull the whole model mid beat
  root.traverse((child) => {
    if (child.isSkinnedMesh) child.frustumCulled = false;
  });

  const box = boxOfVisible(root);

  if (mixer && slot.animations.length) {
    const duration = slot.animations.reduce(
      (longest, clip) => Math.max(longest, clip.duration),
      0
    );
    const poseBox = new THREE.Box3();
    for (let i = 1; i < 8; i++) {
      mixer.setTime((i / 8) * duration);
      box.union(boxOfVisible(root, poseBox));
    }
    mixer.setTime(0);
  }

  if (box.isEmpty()) {
    slot.size = new THREE.Vector3(1, 1, 1);
    return;
  }

  root.position.sub(box.getCenter(new THREE.Vector3()));
  root.updateWorldMatrix(true, true);
  slot.size = box.getSize(new THREE.Vector3());
}

// pull the camera back far enough tht the whole model fits the slot
function frameSlot(slot, aspect) {
  const { size, camera, controls, config } = slot;
  if (!size) return;

  const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
  const halfHeight = size.y / 2;

  // use the footprint diagonal - u can orbit all the way round so it has to
  // fit at any heading, nd deep models project bigger up close
  const halfSpan = Math.hypot(size.x, size.z) / 2;

  const distForHeight = halfHeight / Math.tan(halfFov) + halfSpan;
  const distForWidth = halfSpan / (Math.tan(halfFov) * aspect) + halfSpan;
  const distance =
    Math.max(distForHeight, distForWidth, 1e-6) * (config.fitOffset || 1.1);

  camera.near = Math.max(distance / 1000, 1e-6);
  camera.far = distance * 100;
  camera.updateProjectionMatrix();

  camera.position.set(distance * 0.26, size.y * 0.06, distance * 0.96);
  controls.target.set(0, 0, 0);
  controls.minDistance = Math.max(size.length() * 0.06, camera.near * 10);
  controls.maxDistance = distance * 4;
  controls.update();

  slot.home = {
    position: camera.position.clone(),
    target: controls.target.clone(),
  };
  slot.framedAspect = aspect;
}

/* ----- slots ----- */

function createSlot(el) {
  const key = el.dataset.model;
  const config = MODELS[key];
  if (!config) {
    console.warn(`3D: no model registered for "${key}".`);
    return null;
  }

  const scene = new THREE.Scene();
  scene.environment = environment;
  // no background - canvas clears transparent so the card shows thru

  // lights cant be shared between scenes but theyre cheap
  const key1 = new THREE.DirectionalLight(0xffffff, 2.0);
  key1.position.set(3, 5, 4);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.7);
  fill.position.set(-4, 1, 2);
  const rim = new THREE.DirectionalLight(0xffd8d8, 1.1);
  rim.position.set(0, 2, -5);
  scene.add(key1, fill, rim, new THREE.HemisphereLight(0xffffff, 0x223344, 0.55));

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 5000);
  camera.position.set(0, 0, 5);

  const controls = new OrbitControls(camera, el);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.8;
  controls.panSpeed = 0.8;
  controls.zoomSpeed = 0.9;
  controls.screenSpacePanning = true;
  controls.autoRotateSpeed = 1.2;

  const slot = {
    el,
    stage: el.parentElement,
    key,
    config,
    scene,
    camera,
    controls,
    root: null,
    mixer: null,
    animations: [],
    size: null,
    home: null,
    framedAspect: null,
    onScreen: false,
    started: false,
    playing: true,
    expandBtn: el.querySelector('.slot-expand'),
    loaderEl: el.querySelector('.slot-loader'),
    barEl: el.querySelector('.slot-loader-bar'),
  };

  applyInlineControls(slot);
  return slot;
}

// inline the model must never steal page scroll - pan-y gives vertical swipes
// back to the browser (orbitcontrols sets touch-action none), wheel zoom off too
function applyInlineControls(slot) {
  const { controls } = slot;
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  controls.domElement.style.touchAction = 'pan-y';
}

function applyExpandedControls(slot) {
  const { controls } = slot;
  controls.enableZoom = true;
  controls.enablePan = true;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.domElement.style.touchAction = 'none';
}

// load a slots model - runs once when it first nears view
function startSlot(slot) {
  if (slot.started) return;
  slot.started = true;

  setSlotProgress(slot, 0);

  loadSource(slot.key, (event) => {
    if (event.lengthComputable && event.total) {
      setSlotProgress(slot, event.loaded / event.total);
    }
  })
    .then((source) => {
      slot.root = instantiate(slot.key, source);
      slot.animations = source.animations;
      slot.scene.add(slot.root);

      // mixer b4 measuring so the fit can account for how far the model moves
      if (slot.animations.length) {
        slot.mixer = new THREE.AnimationMixer(slot.root);
        slot.animations.forEach((clip) => slot.mixer.clipAction(clip).play());
        slot.playing = slot.config.autoplay !== false;
      }

      measureSlot(slot);
      const rect = slot.el.getBoundingClientRect();
      frameSlot(slot, rect.height > 0 ? rect.width / rect.height : 1);

      slot.el.classList.add('is-ready');
      slot.loaderEl.classList.add('hidden');
    })
    .catch((error) => {
      console.error(`3D: failed to load "${slot.key}".`, error);
      slot.el.classList.add('is-error');
      slot.loaderEl.textContent = 'Could not load this model.';
    });
}

function setSlotProgress(slot, ratio) {
  if (!slot.barEl) return;
  slot.barEl.style.width = `${Math.round(Math.min(Math.max(ratio, 0), 1) * 100)}%`;
}

/* ----- render loop ----- */

function drawSlot(slot, delta) {
  const rect = slot.el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;

  const aspect = rect.width / rect.height;

  // refit when the slots proportions change enough to matter
  if (slot.framedAspect === null) {
    frameSlot(slot, aspect);
  } else if (Math.abs(aspect - slot.camera.aspect) > 0.001) {
    slot.camera.aspect = aspect;
    slot.camera.updateProjectionMatrix();
  }

  if (slot.mixer && slot.playing) slot.mixer.update(delta);
  slot.controls.update();

  // webgl origin is bottom-left, dom is top-left
  const bottom = window.innerHeight - rect.bottom;
  renderer.setViewport(rect.left, bottom, rect.width, rect.height);
  renderer.setScissor(rect.left, bottom, rect.width, rect.height);
  renderer.render(slot.scene, slot.camera);
}

function tick(timestamp) {
  timer.update(timestamp);
  const delta = timer.getDelta();

  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);

  if (expanded) {
    // drawn last so it covers the neighbours as it grows
    if (growing) {
      slots.forEach((slot) => {
        if (slot !== expanded && slot.onScreen && slot.root) drawSlot(slot, delta);
      });
    }
    drawSlot(expanded, delta);
    updateExpandedLabels();
  } else {
    slots.forEach((slot) => {
      if (slot.onScreen && slot.root) drawSlot(slot, delta);
    });
  }
}

/* ----- expanding a slot ----- */

// freeze scroll without moving anything - overflow hidden removes the scrollbar
// which shifts the layout, so pad the body by the same width
function lockScroll() {
  const barWidth = window.innerWidth - document.documentElement.clientWidth;
  if (barWidth > 0) document.body.style.paddingRight = `${barWidth}px`;
  document.body.classList.add('viewport3d-open');
}

function unlockScroll() {
  document.body.classList.remove('viewport3d-open');
  document.body.style.paddingRight = '';
}

// expanding builds nothing new - the slot just grows to fill the window nd the
// model grows with it. the stage keeps the cards height so the page doesnt jump
function expandSlot(slot) {
  if (expanded || !slot.root) return;
  expanded = slot;

  const sidenav = document.getElementById('mySidenav');
  if (sidenav) sidenav.classList.remove('show');

  // lock first then measure - locking can still move the page
  lockScroll();
  const rect = slot.el.getBoundingClientRect();

  chrome.backdrop.classList.add('open');
  canvas.classList.add('is-expanded');

  chrome.title.textContent = slot.el.dataset.title || 'Model';
  chrome.caption.textContent = slot.el.dataset.caption || '';

  applyExpandedControls(slot);
  buildExpandedLabels(slot);
  syncExpandedToolbar(slot);

  // move the slot out to body - position fixed breaks if an ancestor has a
  // transform nd the card lifts on hover, so the slot wud grow towards the
  // cards bounds instead of the screens. class first so its fixed b4 it lands
  slot.el.classList.add('is-expanded');
  document.body.appendChild(slot.el);

  if (PREFERS_REDUCED_MOTION) {
    slot.el.classList.add('is-settled');
  } else {
    // keep neighbours drawn til the backdrop covers them so they dont pop out
    growing = true;
    clearTimeout(growTimer);
    growTimer = setTimeout(() => {
      growing = false;
    }, 500);

    // start pinned where the slot was, then css grows it out
    slot.el.style.top = `${rect.top}px`;
    slot.el.style.left = `${rect.left}px`;
    slot.el.style.width = `${rect.width}px`;
    slot.el.style.height = `${rect.height}px`;

    void slot.el.offsetWidth; // flush b4 the transition starts

    slot.el.classList.add('is-settled');
    slot.el.style.top = '0px';
    slot.el.style.left = '0px';
    slot.el.style.width = '100%';
    slot.el.style.height = '100%';
  }

  chrome.exitBtn.focus({ preventScroll: true });
}

function collapseSlot() {
  if (!expanded) return;
  const slot = expanded;

  growing = false;
  clearTimeout(growTimer);
  clearExpandedLabels();
  chrome.backdrop.classList.remove('open');
  canvas.classList.remove('is-expanded');
  unlockScroll();

  // measure only now - scroll lock is off so this is where the slot actually
  // lands. stage not parentElement bc the slot is still on body rn
  const rect = slot.stage.getBoundingClientRect();

  // dont leave wireframe/autorotate on for the inline model
  if (expandedState.wireframe) setWireframe(slot, false);
  if (expandedState.autoRotate) setAutoRotate(slot, false);

  applyInlineControls(slot);
  expanded = null;

  const finish = () => {
    slot.el.classList.remove('is-expanded', 'is-settled');
    slot.el.removeAttribute('style');
    slot.stage.appendChild(slot.el); // back into the card
    // deliberately not re-framed - keeps whatever u rotated/zoomed to
  };

  if (PREFERS_REDUCED_MOTION) {
    finish();
    return;
  }

  slot.el.style.top = `${rect.top}px`;
  slot.el.style.left = `${rect.left}px`;
  slot.el.style.width = `${rect.width}px`;
  slot.el.style.height = `${rect.height}px`;

  let done = false;
  const onEnd = (e) => {
    if (done || (e.propertyName !== 'height' && e.propertyName !== 'width')) return;
    done = true;
    slot.el.removeEventListener('transitionend', onEnd);
    finish();
  };
  slot.el.addEventListener('transitionend', onEnd);
  setTimeout(() => {
    if (done) return;
    done = true;
    slot.el.removeEventListener('transitionend', onEnd);
    finish();
  }, 700);
}

/* ----- expanded mode labels ----- */

const _labelPos = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _facing = new THREE.Vector3();
const _toAnchor = new THREE.Vector3();

// labels r built on expand nd thrown away on collapse - inline theyd be unreadable
function buildExpandedLabels(slot) {
  clearExpandedLabels();
  const labels = slot.config.labels || [];

  labels.forEach((label) => {
    const anchor = new THREE.Object3D();
    anchor.position.fromArray(label.at);
    slot.root.add(anchor);

    const el = document.createElement('div');
    el.className = 'model-label';
    el.innerHTML =
      '<span class="label-dot" aria-hidden="true"></span>' +
      `<span class="label-text">${label.text}</span>` +
      (label.info ? `<span class="label-info">${label.info}</span>` : '');

    chrome.labelLayer.appendChild(el);
    expandedLabels.push({
      anchor,
      el,
      facing: label.facing ? new THREE.Vector3().fromArray(label.facing) : null,
    });
  });

  chrome.labelLayer.hidden = expandedLabels.length === 0;
  chrome.tools.labels.hidden = expandedLabels.length === 0;
}

function clearExpandedLabels() {
  expandedLabels.forEach(({ anchor, el }) => {
    anchor.removeFromParent();
    el.remove();
  });
  expandedLabels = [];
}

// move every label chip onto its anchors screen spot. ones facing away get
// dimmed so they dont look like they belong to whats in front
function updateExpandedLabels() {
  if (!expandedLabels.length || !expandedState.labelsVisible || !expanded) return;

  const { camera, controls } = expanded;
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.getWorldDirection(_camDir);

  expandedLabels.forEach(({ anchor, el, facing }) => {
    anchor.getWorldPosition(_labelPos);

    let behind;
    if (facing) {
      // surface normal is the honest test - a chamber wall seen thru the
      // cutaway faces the camera even tho its behind the centre
      _facing.copy(facing).transformDirection(anchor.matrixWorld);
      behind = _facing.dot(_camDir) > 0.15;
    } else {
      _toAnchor.copy(_labelPos).sub(controls.target);
      behind = _toAnchor.dot(_camDir) > 0;
    }

    _labelPos.project(camera);

    // fully behind the camera - park it so the projection doesnt mirror it back
    if (_labelPos.z > 1) {
      el.style.opacity = '0';
      return;
    }

    const x = (_labelPos.x * 0.5 + 0.5) * w;
    const y = (-_labelPos.y * 0.5 + 0.5) * h;
    el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    el.style.opacity = behind ? '0.3' : '1';
    el.classList.toggle('is-behind', behind);
  });
}

/* ----- expanded mode toolbar ----- */

function setAutoRotate(slot, on) {
  expandedState.autoRotate = on;
  slot.controls.autoRotate = on;
  const btn = chrome.tools.autorotate;
  btn.setAttribute('aria-pressed', String(on));
  btn.classList.toggle('active', on);
}

function setWireframe(slot, on) {
  expandedState.wireframe = on;
  slot.root.traverse((obj) => {
    if (!obj.isMesh) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    materials.forEach((m) => {
      if (m) m.wireframe = on;
    });
  });
  const btn = chrome.tools.wireframe;
  btn.setAttribute('aria-pressed', String(on));
  btn.classList.toggle('active', on);
}

function setPlaying(slot, on) {
  slot.playing = on;
  expandedState.animationPlaying = on;
  const btn = chrome.tools.animation;
  btn.setAttribute('aria-pressed', String(on));
  btn.querySelector('span[aria-hidden]').textContent = on ? '⏸' : '▶';
  btn.querySelector('.tool-label').textContent = on ? 'Pause' : 'Play';
}

function setLabelsVisible(on) {
  expandedState.labelsVisible = on;
  chrome.labelLayer.classList.toggle('labels-off', !on);
  const btn = chrome.tools.labels;
  btn.setAttribute('aria-pressed', String(on));
  btn.classList.toggle('active', on);
  if (on) updateExpandedLabels();
}

function resetView(slot) {
  if (!slot.home) return;
  slot.camera.position.copy(slot.home.position);
  slot.controls.target.copy(slot.home.target);
  slot.controls.update();
}

function syncExpandedToolbar(slot) {
  const hasAnimation = slot.animations.length > 0;
  chrome.tools.animation.hidden = !hasAnimation;
  if (hasAnimation) setPlaying(slot, slot.playing);

  setAutoRotate(slot, false);
  setWireframe(slot, false);
  setLabelsVisible(true);
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  } else {
    document.documentElement.requestFullscreen().catch((err) => {
      console.warn('3D: fullscreen was refused.', err);
    });
  }
}

/* ----- ?pick helper ----- */

// click with ?pick in the url nd it logs the point u hit + surface normal,
// ready to paste into labels. thts how all the coords in MODELS were found
function pickLabelPoint(slot, event) {
  const rect = slot.el.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, slot.camera);
  const hit = raycaster.intersectObject(slot.root, true)[0];
  if (!hit) {
    console.log('pick: nothing under the cursor');
    return;
  }

  const round = (v) => Number(v.toFixed(3));
  const at = slot.root.worldToLocal(hit.point.clone()).toArray().map(round);

  let facing = null;
  if (hit.face) {
    const worldNormal = hit.face.normal
      .clone()
      .transformDirection(hit.object.matrixWorld);
    facing = slot.root
      .worldToLocal(worldNormal.add(slot.root.getWorldPosition(new THREE.Vector3())))
      .normalize()
      .toArray()
      .map(round);
  }

  console.log(
    `PICK [${slot.key}] at: ${JSON.stringify(at)}, facing: ${JSON.stringify(facing)}` +
      `  (hit "${hit.object.name || 'unnamed'}")`
  );
}

/* ----- wiring ----- */

function cacheChrome() {
  chrome.backdrop = document.getElementById('viewportBackdrop');
  chrome.ui = document.getElementById('viewportChrome');
  chrome.title = document.getElementById('viewportTitle');
  chrome.caption = document.getElementById('viewportCaption');
  chrome.exitBtn = document.getElementById('exit3dBtn');
  chrome.labelLayer = document.getElementById('viewportLabels');
  chrome.tools = {};
  chrome.ui.querySelectorAll('.tool-btn').forEach((btn) => {
    chrome.tools[btn.dataset.action] = btn;
  });
}

function init() {
  cacheChrome();
  initRenderer();

  document.querySelectorAll('.model-slot').forEach((el) => {
    const slot = createSlot(el);
    if (!slot) return;
    slots.push(slot);

    if (slot.expandBtn) {
      // orbitcontrols captures the pointer on pointerdown so clicks never
      // reach the btn - stop it bubbling nd the click lands normally
      slot.expandBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
      slot.expandBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        expandSlot(slot);
      });
    }

    if (PICK_MODE) {
      el.addEventListener('click', (e) => {
        if (slot.root) pickLabelPoint(slot, e);
      });
    }
  });

  // load a model shortly b4 its slot reaches the screen, nd only draw slots
  // tht r actually visible
  const nearView = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const slot = slots.find((s) => s.el === entry.target);
        if (!slot) return;
        slot.onScreen = entry.isIntersecting;
        if (entry.isIntersecting) startSlot(slot);
      });
    },
    { rootMargin: '200px 0px' }
  );
  slots.forEach((slot) => nearView.observe(slot.el));

  chrome.exitBtn.addEventListener('click', collapseSlot);

  const actions = {
    reset: () => expanded && resetView(expanded),
    autorotate: () => expanded && setAutoRotate(expanded, !expandedState.autoRotate),
    wireframe: () => expanded && setWireframe(expanded, !expandedState.wireframe),
    animation: () => expanded && setPlaying(expanded, !expandedState.animationPlaying),
    labels: () => expanded && setLabelsVisible(!expandedState.labelsVisible),
    fullscreen: toggleFullscreen,
  };
  Object.entries(actions).forEach(([name, handler]) => {
    const btn = chrome.tools[name];
    if (btn) btn.addEventListener('click', handler);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && expanded && !document.fullscreenElement) {
      collapseSlot();
      return;
    }
    if (!expanded || e.metaKey || e.ctrlKey || e.altKey) return;

    const handler = {
      r: actions.reset,
      a: actions.autorotate,
      w: actions.wireframe,
      l: actions.labels,
      f: actions.fullscreen,
      ' ': actions.animation,
    }[e.key.toLowerCase()];

    if (handler) {
      e.preventDefault();
      handler();
    }
  });

  if (PICK_MODE) {
    console.log('3D: label picker on - click a model to log a point.');
  }

  renderer.setAnimationLoop(tick);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
