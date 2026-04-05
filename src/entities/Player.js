import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Bullet } from "./Bullet.js";

const PLAYER_SPEED = 8;
const SHOOT_OFFSET = 0.55;
const MAX_CHARGE_TIME = 0.8;

const MIN_BULLET_SPEED = 12;
const MAX_BULLET_SPEED = 28;
const MIN_BULLET_SIZE = 0.15;
const MAX_BULLET_SIZE = 0.35;
const MIN_BULLET_LIFETIME = 1;
const MAX_BULLET_LIFETIME = 3.5;

const MIN_BULLET_COLOR = new THREE.Color(0xffee00);
const MAX_BULLET_COLOR = new THREE.Color(0xff6600);
const PLAYER_MODEL_SCALE = 1;
const PLAYER_MODEL_URL = "/models/BusinessMan.glb";
const PLAYER_MODEL_COLOR = 0xffffff;
const WEAPON_MODEL_URL = "/models/DesertEagle.glb";
const KATANA_MODEL_URL = "/models/Katana.glb";

function applySolidColor(material, colorHex) {
  if (!material) {
    return;
  }

  if ("map" in material) {
    material.map = null;
  }
  if ("emissiveMap" in material) {
    material.emissiveMap = null;
  }
  if ("color" in material && material.color) {
    material.color.setHex(colorHex);
  }
  if ("emissive" in material && material.emissive) {
    material.emissive.setHex(0x000000);
  }

  material.needsUpdate = true;
}

export class Player {
  constructor() {
    this.root = new THREE.Group();
    this.root.position.set(0, 0.02, 0);

    this.direction = new THREE.Vector3(0, 0, 1);
    this.moveDelta = new THREE.Vector3();
    this.chargeTime = 0;
    this.isCharging = false;
    this.alive = true;

    this.loaded = false;
    this.model = null;
    this.playerModel = null;
    this.mixer = null;
    this.clips = {};
    this.currentAction = null;
    this.currentAnimName = "";
    this.weaponMesh = null;
    this.weaponMixer = null;
    this.weaponShootAction = null;
    this.katanaMesh = null;
    this.isAttacking = false;

    const loader = new GLTFLoader();
    loader.load(
      PLAYER_MODEL_URL,
      (gltf) => {
        this.model = gltf.scene;
        this.playerModel = gltf.scene;
        this.model.scale.setScalar(PLAYER_MODEL_SCALE);

        let handBone = null;
        gltf.scene.traverse((node) => {
          if (node.name === "WristR") {
            handBone = node;
          }
        });

        this.model.traverse((object) => {
          if (!object.isMesh) {
            return;
          }

          if (Array.isArray(object.material)) {
            object.material.forEach((material) =>
              applySolidColor(material, PLAYER_MODEL_COLOR),
            );
          } else {
            applySolidColor(object.material, PLAYER_MODEL_COLOR);
          }
        });

        this.root.add(this.model);

        const katanaLoader = new GLTFLoader();
        katanaLoader.load(KATANA_MODEL_URL, (katanaGltf) => {
          this.katanaMesh = katanaGltf.scene;

          this.katanaMesh.traverse((object) => {
            if (!object.isMesh) {
              return;
            }

            if (Array.isArray(object.material)) {
              object.material.forEach((material) => {
                material.side = THREE.DoubleSide;
                material.needsUpdate = true;
              });
            } else if (object.material) {
              object.material.side = THREE.DoubleSide;
              object.material.needsUpdate = true;
            }
          });

          let leftWrist = null;
          this.playerModel.traverse((node) => {
            const nodeName = (node.name ?? "").toLowerCase();
            if (
              node.name === "WristL" ||
              nodeName.includes("wristl") ||
              (nodeName.includes("wrist") && nodeName.includes("l")) ||
              (nodeName.includes("hand") && nodeName.includes("l"))
            ) {
              leftWrist = node;
            }
          });

          const attachTarget = leftWrist ?? this.playerModel;
          attachTarget.add(this.katanaMesh);

          const bounds = new THREE.Box3().setFromObject(this.katanaMesh);
          const size = new THREE.Vector3();
          bounds.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          const targetSize = 0.9;
          const scaleFactor = maxDim > 1e-6 ? targetSize / maxDim : 1;

          this.katanaMesh.scale.setScalar(scaleFactor);
          this.katanaMesh.position.set(0, 0.002, 0);
          this.katanaMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2);

          this.katanaMesh.visible = false;
        });

        const weaponLoader = new GLTFLoader();
        weaponLoader.load(WEAPON_MODEL_URL, (weaponGltf) => {
          this.weaponMesh = weaponGltf.scene;

          this.weaponMixer = new THREE.AnimationMixer(weaponGltf.scene);
          weaponGltf.animations.forEach((clip) => {
            if (clip.name === "desert_eagle|shoot") {
              this.weaponShootAction = this.weaponMixer.clipAction(clip);
              this.weaponShootAction.setLoop(THREE.LoopOnce, 1);
              this.weaponShootAction.clampWhenFinished = true;
            }
          });

          if (handBone) {
            handBone.add(this.weaponMesh);
          } else {
            gltf.scene.add(this.weaponMesh);
          }

          this.weaponMesh.position.set(0, 0.002, 0);
          this.weaponMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
          this.weaponMesh.scale.set(0.0009, 0.0009, 0.0009);
          this.weaponMesh.visible = true;
        });

        this.mixer = new THREE.AnimationMixer(this.model);
        this.clips = {};
        gltf.animations.forEach((clip) => {
          this.clips[clip.name] = clip;
        });

        this.loaded = true;
        this.playAnimation("Idle_Gun", 0);
      },
      undefined,
      (error) => {
        console.error("Failed to load player model:", error);
      },
    );
  }

  get mesh() {
    return this.root;
  }

  get position() {
    return this.root.position;
  }

  getChargeRatio() {
    return Math.min(this.chargeTime / MAX_CHARGE_TIME, 1);
  }

  playAnimation(name, fadeTime = 0.2, loopOnce = false) {
    if (!this.loaded || !this.mixer || this.currentAnimName === name) {
      return;
    }

    const clip =
      this.clips[`CharacterArmature|${name}`] ?? this.clips[name] ?? null;
    if (!clip) {
      return;
    }

    const next = this.mixer.clipAction(clip);
    if (loopOnce) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
    }

    if (this.currentAction && this.currentAction !== next) {
      this.currentAction.crossFadeTo(next, fadeTime, true);
    }

    next.reset().play();
    this.currentAction = next;
    this.currentAnimName = name;
  }

  setDead() {
    if (!this.alive) {
      return;
    }

    this.alive = false;
    this.isCharging = false;
    this.chargeTime = 0;
    this.playAnimation("Death", 0.2, true);
  }

  onMouseDown() {
    if (!this.alive || this.isAttacking) {
      return;
    }

    this.isCharging = true;
  }

  onMouseUp(scene, bullets) {
    if (!this.isCharging || !this.alive || this.isAttacking) {
      return null;
    }

    const chargeRatio = this.getChargeRatio();
    const bulletColor = new THREE.Color().lerpColors(
      MIN_BULLET_COLOR,
      MAX_BULLET_COLOR,
      chargeRatio,
    );

    const spawnPosition = this.root.position
      .clone()
      .addScaledVector(this.direction, SHOOT_OFFSET);

    const bullet = new Bullet(scene, spawnPosition, this.direction.clone(), {
      speed: THREE.MathUtils.lerp(
        MIN_BULLET_SPEED,
        MAX_BULLET_SPEED,
        chargeRatio,
      ),
      size: THREE.MathUtils.lerp(MIN_BULLET_SIZE, MAX_BULLET_SIZE, chargeRatio),
      lifetime: THREE.MathUtils.lerp(
        MIN_BULLET_LIFETIME,
        MAX_BULLET_LIFETIME,
        chargeRatio,
      ),
      color: bulletColor,
    });

    bullets.push(bullet);
    if (this.weaponShootAction) {
      this.weaponShootAction.reset().play();
    }
    this.chargeTime = 0;
    this.isCharging = false;
    return bullet;
  }

  update(delta, keys, mouseWorldPos, cameraAzimuth = 0) {
    if (!this.loaded) {
      return;
    }

    if (this.mixer) {
      this.mixer.update(delta);
    }
    if (this.weaponMixer) {
      this.weaponMixer.update(delta);
    }

    if (this.weaponMesh) {
      this.weaponMesh.visible = !this.isAttacking;
    }
    if (this.katanaMesh) {
      this.katanaMesh.visible = this.isAttacking;
    }

    if (!this.alive) {
      this.playAnimation("Death", 0.2, true);
      return;
    }

    let moveX = 0;
    let moveZ = 0;

    if (keys.has("KeyW") || keys.has("ArrowUp")) {
      moveZ -= 1;
    }
    if (keys.has("KeyS") || keys.has("ArrowDown")) {
      moveZ += 1;
    }
    if (keys.has("KeyA") || keys.has("ArrowLeft")) {
      moveX -= 1;
    }
    if (keys.has("KeyD") || keys.has("ArrowRight")) {
      moveX += 1;
    }

    const inputLength = Math.hypot(moveX, moveZ);
    const isMoving = inputLength > 0;
    const isMovingFast =
      isMoving && (keys.has("ShiftLeft") || keys.has("ShiftRight"));

    if (inputLength > 0) {
      moveX /= inputLength;
      moveZ /= inputLength;

      const cos = Math.cos(cameraAzimuth);
      const sin = Math.sin(cameraAzimuth);
      const worldMoveX = moveX * cos + moveZ * sin;
      const worldMoveZ = -moveX * sin + moveZ * cos;

      this.moveDelta
        .set(worldMoveX, 0, worldMoveZ)
        .multiplyScalar(PLAYER_SPEED * delta);
      this.root.position.add(this.moveDelta);
    }

    if (mouseWorldPos) {
      const lookX = mouseWorldPos.x - this.root.position.x;
      const lookZ = mouseWorldPos.z - this.root.position.z;
      const lookLengthSq = lookX * lookX + lookZ * lookZ;

      if (lookLengthSq > 1e-6) {
        const invLength = 1 / Math.sqrt(lookLengthSq);
        this.direction.set(lookX * invLength, 0, lookZ * invLength);
        this.root.rotation.y = Math.atan2(this.direction.x, this.direction.z);
      }
    }

    if (this.isCharging) {
      this.chargeTime = Math.min(this.chargeTime + delta, MAX_CHARGE_TIME);
    }

    if (this.isAttacking) {
      return;
    }

    if (this.isCharging) {
      this.playAnimation("Gun_Shoot");
    } else if (isMovingFast) {
      this.playAnimation("Run");
    } else if (isMoving) {
      this.playAnimation("Walk");
    } else {
      this.playAnimation("Idle_Gun");
    }
  }

  meleeAttack() {
    if (this.isAttacking || !this.alive || !this.loaded) {
      return;
    }

    this.isAttacking = true;
    this.isCharging = false;
    if (this.weaponMesh) {
      this.weaponMesh.visible = false;
    }
    if (this.katanaMesh) {
      this.katanaMesh.visible = true;
    }
    this.playAnimation("Sword_Slash", 0.1);

    setTimeout(() => {
      this.isAttacking = false;
      if (this.weaponMesh) {
        this.weaponMesh.visible = true;
      }
      if (this.katanaMesh) {
        this.katanaMesh.visible = false;
      }
    }, 1000);
  }
}
