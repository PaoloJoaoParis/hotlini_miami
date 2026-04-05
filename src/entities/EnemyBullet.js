import * as THREE from "three";

const ENEMY_BULLET_SPEED = 12;
const ENEMY_BULLET_LIFETIME = 2.5;

export class EnemyBullet {
  constructor(scene, startPosition, direction) {
    this.scene = scene;
    this.alive = true;
    this.wallImpact = false;
    this.lifetime = ENEMY_BULLET_LIFETIME;
    this.direction = direction.clone().setY(0).normalize();

    const geometry = new THREE.PlaneGeometry(0.15, 0.15);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff6b6b,
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

    this.mesh.position.addScaledVector(this.direction, ENEMY_BULLET_SPEED * delta);

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
