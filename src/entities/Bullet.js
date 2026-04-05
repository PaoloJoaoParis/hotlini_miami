import * as THREE from "three";

const BULLET_SPEED = 20;
const BULLET_LIFETIME = 2;

export class Bullet {
  constructor(scene, startPosition, direction, options = {}) {
    this.scene = scene;
    this.alive = true;
    this.wallImpact = false;
    this.speed = options.speed ?? BULLET_SPEED;
    this.size = options.size ?? 0.15;
    this.lifetime = options.lifetime ?? BULLET_LIFETIME;
    this.direction = direction.clone().setY(0).normalize();

    const geometry = new THREE.PlaneGeometry(this.size, this.size);
    const color = options.color ?? 0xffee00;
    const material = new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.copy(startPosition);
    this.mesh.position.y = 0.03;

    this.scene.add(this.mesh);
  }

  update(delta, wallMeshes) {
    if (!this.alive) {
      return;
    }

    this.lifetime -= delta;
    if (this.lifetime <= 0) {
      this.alive = false;
      return;
    }

    this.mesh.position.addScaledVector(this.direction, this.speed * delta);

    if (this.#isInsideAnyWall(wallMeshes)) {
      this.wallImpact = true;
      this.alive = false;
    }
  }

  isAlive() {
    return this.alive;
  }

  consumeWallImpact() {
    const hadWallImpact = this.wallImpact;
    this.wallImpact = false;
    return hadWallImpact;
  }

  destroy(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }

  #isInsideAnyWall(wallMeshes) {
    const bulletX = this.mesh.position.x;
    const bulletZ = this.mesh.position.z;

    for (const wallMesh of wallMeshes) {
      const minX = wallMesh.position.x - 0.5;
      const maxX = wallMesh.position.x + 0.5;
      const minZ = wallMesh.position.z - 0.5;
      const maxZ = wallMesh.position.z + 0.5;

      if (bulletX >= minX && bulletX <= maxX && bulletZ >= minZ && bulletZ <= maxZ) {
        return true;
      }
    }

    return false;
  }
}
