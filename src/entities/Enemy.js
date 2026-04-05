import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CELL_TYPES } from "../world/MapGenerator.js";

const ENEMY_HALF_SIZE = 0.4;
const PATROL_SPEED = 3;
const CHASE_SPEED = 5;
const ARRIVAL_DISTANCE = 0.15;
const PATROL_WAIT_SECONDS = 1;
const CHASE_ENTER_DISTANCE = 8;
const CHASE_EXIT_DISTANCE = 12;
const LINE_OF_SIGHT_STEP = 0.2;
const SHOOT_INTERVAL_SECONDS = 1.5;
const SHOOT_OFFSET = 0.55;
const SHOOT_ANIM_SECONDS = 0.2;
const ENEMY_MODEL_SCALE = 1;
const ENEMY_MODEL_URL = "/models/Swat.glb";
const ENEMY_MODEL_COLOR = 0xff0000;
const ENEMY_WEAPON_MODEL_URL = "/models/DesertEagle.glb";

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

const ENEMY_STATE = {
  PATROL: "PATROL",
  CHASE: "CHASE",
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class Enemy {
  constructor(room, gridWidth, gridHeight, rng) {
    this.room = room;
    this.gridWidth = gridWidth;
    this.gridHeight = gridHeight;
    this.rng = rng;

    this.root = new THREE.Group();
    this.root.position.set(0, 0.02, 0);

    this.state = ENEMY_STATE.PATROL;
    this.waitTimer = 0;
    this.alive = true;
    this.deathFinished = false;
    this.shootTimer = SHOOT_INTERVAL_SECONDS;
    this.shootAnimTimer = 0;
    this.direction = new THREE.Vector3(0, 0, 1);
    this.patrolTarget = this.#pickRandomPatrolTarget();

    this.loaded = false;
    this.model = null;
    this.weaponMesh = null;
    this.mixer = null;
    this.clips = {};
    this.currentAction = null;
    this.currentAnimName = "";

    const loader = new GLTFLoader();
    loader.load(
      ENEMY_MODEL_URL,
      (gltf) => {
        this.model = gltf.scene;
        this.model.scale.setScalar(ENEMY_MODEL_SCALE);

        this.model.traverse((object) => {
          if (!object.isMesh) {
            return;
          }

          if (Array.isArray(object.material)) {
            object.material.forEach((material) =>
              applySolidColor(material, ENEMY_MODEL_COLOR),
            );
          } else {
            applySolidColor(object.material, ENEMY_MODEL_COLOR);
          }
        });

        this.root.add(this.model);

        let handBone = null;
        this.model.traverse((node) => {
          if (node.name === "WristR") {
            handBone = node;
          }
        });

        const weaponLoader = new GLTFLoader();
        weaponLoader.load(ENEMY_WEAPON_MODEL_URL, (weaponGltf) => {
          this.weaponMesh = weaponGltf.scene;

          if (handBone) {
            handBone.add(this.weaponMesh);
          } else {
            this.model.add(this.weaponMesh);
          }

          this.weaponMesh.position.set(0, 0.002, 0);
          this.weaponMesh.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
          this.weaponMesh.scale.set(0.0009, 0.0009, 0.0009);
        });

        this.mixer = new THREE.AnimationMixer(this.model);
        this.clips = {};
        gltf.animations.forEach((clip) => {
          this.clips[clip.name] = clip;
        });

        this.mixer.addEventListener("finished", () => {
          if (this.currentAnimName === "Death") {
            this.deathFinished = true;
          }
        });

        this.loaded = true;
        this.playAnimation("Idle_Gun", 0);
      },
      undefined,
      (error) => {
        console.error("Failed to load enemy model:", error);
      },
    );
  }

  get mesh() {
    return this.root;
  }

  get position() {
    return this.root.position;
  }

  isAlive() {
    return this.alive;
  }

  canBeRemoved() {
    return !this.alive && (!this.loaded || this.deathFinished);
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

  kill() {
    if (!this.alive) {
      return;
    }

    this.alive = false;
    this.shootAnimTimer = 0;
    this.playAnimation("Death", 0.2, true);
  }

  destroy(scene) {
    scene.remove(this.root);

    this.root.traverse((object) => {
      if (!object.isMesh) {
        return;
      }

      object.geometry?.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose());
      } else {
        object.material?.dispose();
      }
    });
  }

  update(delta, playerPosition, grid, _bullets) {
    if (!this.loaded) {
      return null;
    }

    if (this.mixer) {
      this.mixer.update(delta);
    }

    if (!this.alive) {
      this.playAnimation("Death", 0.2, true);
      return null;
    }

    this.shootAnimTimer = Math.max(0, this.shootAnimTimer - delta);
    let shot = null;
    let isMoving = false;
    let isWaiting = false;

    const toPlayer = new THREE.Vector3().subVectors(
      playerPosition,
      this.root.position,
    );
    toPlayer.y = 0;
    const distanceToPlayer = toPlayer.length();
    const canSeePlayer =
      distanceToPlayer < CHASE_ENTER_DISTANCE &&
      this.#hasLineOfSight(playerPosition, grid);

    if (this.state === ENEMY_STATE.PATROL && canSeePlayer) {
      this.state = ENEMY_STATE.CHASE;
      this.shootTimer = SHOOT_INTERVAL_SECONDS;
    } else if (
      this.state === ENEMY_STATE.CHASE &&
      !canSeePlayer &&
      distanceToPlayer > CHASE_EXIT_DISTANCE
    ) {
      this.state = ENEMY_STATE.PATROL;
      this.waitTimer = 0;
      this.patrolTarget = this.#pickRandomPatrolTarget();
      this.shootTimer = SHOOT_INTERVAL_SECONDS;
    }

    if (this.state === ENEMY_STATE.CHASE) {
      if (distanceToPlayer > 1e-6) {
        toPlayer.multiplyScalar(1 / distanceToPlayer);
        this.direction.copy(toPlayer);
        this.root.rotation.y = Math.atan2(this.direction.x, this.direction.z);
        this.#moveWithCollision(delta, this.direction, CHASE_SPEED, grid);
        isMoving = true;
      }

      this.shootTimer -= delta;
      if (this.shootTimer <= 0 && distanceToPlayer > 1e-6) {
        const shotDirection = new THREE.Vector3().subVectors(
          playerPosition,
          this.root.position,
        );
        shotDirection.y = 0;

        if (shotDirection.lengthSq() > 1e-6) {
          shotDirection.normalize();
          shot = {
            position: this.root.position
              .clone()
              .addScaledVector(shotDirection, SHOOT_OFFSET),
            direction: shotDirection,
          };
        }

        this.shootTimer = SHOOT_INTERVAL_SECONDS;
        this.shootAnimTimer = SHOOT_ANIM_SECONDS;
      }

      if (this.shootAnimTimer > 0) {
        this.playAnimation("Idle_Gun_Shoot");
      } else {
        this.playAnimation("Run");
      }

      return shot;
    }

    if (this.waitTimer > 0) {
      isWaiting = true;
      this.waitTimer -= delta;
      if (this.waitTimer <= 0) {
        this.patrolTarget = this.#pickRandomPatrolTarget();
      }
    } else {
      const toTarget = new THREE.Vector3().subVectors(
        this.patrolTarget,
        this.root.position,
      );
      toTarget.y = 0;
      const distanceToTarget = toTarget.length();

      if (distanceToTarget <= ARRIVAL_DISTANCE) {
        this.waitTimer = PATROL_WAIT_SECONDS;
        isWaiting = true;
      } else {
        toTarget.multiplyScalar(1 / Math.max(distanceToTarget, 1e-6));
        this.direction.copy(toTarget);
        this.root.rotation.y = Math.atan2(this.direction.x, this.direction.z);
        this.#moveWithCollision(delta, this.direction, PATROL_SPEED, grid);
        isMoving = true;
      }
    }

    if (this.shootAnimTimer > 0) {
      this.playAnimation("Idle_Gun_Shoot");
    } else if (isMoving) {
      this.playAnimation("Walk");
    } else if (isWaiting) {
      this.playAnimation("Idle_Gun");
    } else {
      this.playAnimation("Idle_Gun");
    }

    return null;
  }

  #moveWithCollision(delta, direction, speed, grid) {
    const previousX = this.root.position.x;
    const previousZ = this.root.position.z;

    this.root.position.x += direction.x * speed * delta;
    this.root.position.z += direction.z * speed * delta;

    const currentX = this.root.position.x;
    const currentZ = this.root.position.z;

    if (!this.#overlapsWall(currentX, currentZ, grid)) {
      return;
    }

    if (this.#overlapsWall(currentX, previousZ, grid)) {
      this.root.position.x = previousX;
    }

    if (this.#overlapsWall(this.root.position.x, currentZ, grid)) {
      this.root.position.z = previousZ;
    }
  }

  #overlapsWall(worldX, worldZ, grid) {
    return (
      this.#isWallAtWorld(
        worldX - ENEMY_HALF_SIZE,
        worldZ - ENEMY_HALF_SIZE,
        grid,
      ) ||
      this.#isWallAtWorld(
        worldX + ENEMY_HALF_SIZE,
        worldZ - ENEMY_HALF_SIZE,
        grid,
      ) ||
      this.#isWallAtWorld(
        worldX - ENEMY_HALF_SIZE,
        worldZ + ENEMY_HALF_SIZE,
        grid,
      ) ||
      this.#isWallAtWorld(
        worldX + ENEMY_HALF_SIZE,
        worldZ + ENEMY_HALF_SIZE,
        grid,
      )
    );
  }

  #isWallAtWorld(worldX, worldZ, grid) {
    const cell = this.#worldToGrid(worldX, worldZ);

    if (
      cell.x < 0 ||
      cell.y < 0 ||
      cell.x >= this.gridWidth ||
      cell.y >= this.gridHeight
    ) {
      return true;
    }

    return grid[cell.y][cell.x] === CELL_TYPES.WALL;
  }

  #hasLineOfSight(playerPosition, grid) {
    const from = this.root.position;
    const to = playerPosition;

    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distance = Math.hypot(dx, dz);

    if (distance < 1e-6) {
      return true;
    }

    const dirX = dx / distance;
    const dirZ = dz / distance;

    for (
      let traveled = LINE_OF_SIGHT_STEP;
      traveled < distance;
      traveled += LINE_OF_SIGHT_STEP
    ) {
      const sampleX = from.x + dirX * traveled;
      const sampleZ = from.z + dirZ * traveled;

      if (this.#isWallAtWorld(sampleX, sampleZ, grid)) {
        return false;
      }
    }

    return true;
  }

  #worldToGrid(worldX, worldZ) {
    return {
      x: Math.floor(worldX + this.gridWidth / 2),
      y: Math.floor(worldZ + this.gridHeight / 2),
    };
  }

  #gridToWorld(cellX, cellY) {
    return {
      x: cellX - this.gridWidth / 2 + 0.5,
      z: cellY - this.gridHeight / 2 + 0.5,
    };
  }

  #pickRandomPatrolTarget() {
    const maxCellX = this.room.x + this.room.width - 1;
    const maxCellY = this.room.y + this.room.height - 1;

    const cellX = Math.floor(this.rng.between(this.room.x, maxCellX + 1));
    const cellY = Math.floor(this.rng.between(this.room.y, maxCellY + 1));

    const world = this.#gridToWorld(
      clamp(cellX, this.room.x, maxCellX),
      clamp(cellY, this.room.y, maxCellY),
    );

    return new THREE.Vector3(world.x, 0.02, world.z);
  }
}
