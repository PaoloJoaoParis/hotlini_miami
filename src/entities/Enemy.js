import * as THREE from "three";
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

    const bodyGeometry = new THREE.PlaneGeometry(0.8, 0.8);
    const bodyMaterial = new THREE.MeshBasicMaterial({
      color: 0xe63946,
      side: THREE.DoubleSide,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.bodyMesh.rotation.x = -Math.PI / 2;
    this.root.add(this.bodyMesh);

    const indicatorGeometry = new THREE.PlaneGeometry(0.15, 0.3);
    const indicatorMaterial = new THREE.MeshBasicMaterial({
      color: 0x3a1115,
      side: THREE.DoubleSide,
    });
    this.indicatorMesh = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    this.indicatorMesh.rotation.x = -Math.PI / 2;
    this.indicatorMesh.position.set(0, 0.01, 0.28);
    this.root.add(this.indicatorMesh);

    this.root.position.set(0, 0.02, 0);

    this.state = ENEMY_STATE.PATROL;
    this.waitTimer = 0;
    this.alive = true;
    this.shootTimer = SHOOT_INTERVAL_SECONDS;
    this.direction = new THREE.Vector3(0, 0, 1);
    this.patrolTarget = this.#pickRandomPatrolTarget();
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

  kill() {
    this.alive = false;
  }

  destroy(scene) {
    scene.remove(this.root);
    this.bodyMesh.geometry.dispose();
    this.bodyMesh.material.dispose();
    this.indicatorMesh.geometry.dispose();
    this.indicatorMesh.material.dispose();
  }

  update(delta, playerPosition, grid, _bullets) {
    if (!this.alive) {
      return null;
    }

    let shot = null;

    const toPlayer = new THREE.Vector3().subVectors(playerPosition, this.root.position);
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
      }

      return shot;
    }

    if (this.waitTimer > 0) {
      this.waitTimer -= delta;
      if (this.waitTimer <= 0) {
        this.patrolTarget = this.#pickRandomPatrolTarget();
      }
      return null;
    }

    const toTarget = new THREE.Vector3().subVectors(this.patrolTarget, this.root.position);
    toTarget.y = 0;
    const distanceToTarget = toTarget.length();

    if (distanceToTarget <= ARRIVAL_DISTANCE) {
      this.waitTimer = PATROL_WAIT_SECONDS;
      return;
    }

    toTarget.multiplyScalar(1 / Math.max(distanceToTarget, 1e-6));
    this.direction.copy(toTarget);
    this.root.rotation.y = Math.atan2(this.direction.x, this.direction.z);
    this.#moveWithCollision(delta, this.direction, PATROL_SPEED, grid);
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
      this.#isWallAtWorld(worldX - ENEMY_HALF_SIZE, worldZ - ENEMY_HALF_SIZE, grid) ||
      this.#isWallAtWorld(worldX + ENEMY_HALF_SIZE, worldZ - ENEMY_HALF_SIZE, grid) ||
      this.#isWallAtWorld(worldX - ENEMY_HALF_SIZE, worldZ + ENEMY_HALF_SIZE, grid) ||
      this.#isWallAtWorld(worldX + ENEMY_HALF_SIZE, worldZ + ENEMY_HALF_SIZE, grid)
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

    for (let traveled = LINE_OF_SIGHT_STEP; traveled < distance; traveled += LINE_OF_SIGHT_STEP) {
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
