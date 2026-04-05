import * as THREE from "three";
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

export class Player {
  constructor() {
    this.root = new THREE.Group();

    const bodyGeometry = new THREE.PlaneGeometry(0.8, 0.8);
    const bodyMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    this.bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.bodyMesh.rotation.x = -Math.PI / 2;
    this.root.add(this.bodyMesh);

    const indicatorGeometry = new THREE.PlaneGeometry(0.15, 0.3);
    const indicatorMaterial = new THREE.MeshBasicMaterial({
      color: 0x121212,
      side: THREE.DoubleSide,
    });
    this.indicatorMesh = new THREE.Mesh(indicatorGeometry, indicatorMaterial);
    this.indicatorMesh.rotation.x = -Math.PI / 2;
    this.indicatorMesh.position.set(0, 0.01, 0.28);
    this.root.add(this.indicatorMesh);

    this.root.position.set(0, 0.02, 0);

    this.direction = new THREE.Vector3(0, 0, 1);
    this.moveDelta = new THREE.Vector3();
    this.chargeTime = 0;
    this.isCharging = false;
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

  onMouseDown() {
    this.isCharging = true;
  }

  onMouseUp(scene, bullets) {
    if (!this.isCharging) {
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
      speed: THREE.MathUtils.lerp(MIN_BULLET_SPEED, MAX_BULLET_SPEED, chargeRatio),
      size: THREE.MathUtils.lerp(MIN_BULLET_SIZE, MAX_BULLET_SIZE, chargeRatio),
      lifetime: THREE.MathUtils.lerp(
        MIN_BULLET_LIFETIME,
        MAX_BULLET_LIFETIME,
        chargeRatio,
      ),
      color: bulletColor,
    });

    bullets.push(bullet);
    this.chargeTime = 0;
    this.isCharging = false;
    return bullet;
  }

  update(delta, keys, mouseWorldPos) {
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

    this.moveDelta.set(moveX, 0, moveZ);

    if (this.moveDelta.lengthSq() > 0) {
      this.moveDelta.normalize().multiplyScalar(PLAYER_SPEED * delta);
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
  }
}
