import * as THREE from "three";

const SHAKE_DURATION = 0.12;
const BASE_SHAKE_INTENSITY = 0.15;
const KILL_FLASH_DURATION = 0.08;
const GAME_OVER_FLASH_DURATION = 0.25;
const KILL_FLASH_COLOR = 0x1a0000;
const GAME_OVER_FLASH_COLOR = 0xff0000;
const DEFAULT_BG_COLOR = 0x0b0b0b;

const PARTICLE_COUNT = 8;
const PARTICLE_LIFETIME = 0.4;
const PARTICLE_MIN_SPEED = 2;
const PARTICLE_MAX_SPEED = 5;

const TRAIL_OPACITIES = [0.6, 0.3, 0.1];

function randomRange(rng, min, max) {
  return rng ? rng.between(min, max) : min + Math.random() * (max - min);
}

export class EffectsManager {
  constructor(scene, renderer, rng) {
    this.scene = scene;
    this.renderer = renderer;
    this.rng = rng;

    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.shakeOffset = new THREE.Vector3();

    this.flashTimer = 0;
    this.flashDuration = 0;
    this.flashColor = new THREE.Color(DEFAULT_BG_COLOR);
    this.defaultColor = new THREE.Color(DEFAULT_BG_COLOR);

    this.particles = [];
    this.bulletTrails = new Map();

    this.renderer.setClearColor(this.defaultColor, 1);
  }

  shake(intensity = BASE_SHAKE_INTENSITY) {
    this.shakeTimer = SHAKE_DURATION;
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  triggerKillFlash() {
    this.flashDuration = KILL_FLASH_DURATION;
    this.flashTimer = KILL_FLASH_DURATION;
    this.flashColor.setHex(KILL_FLASH_COLOR);
  }

  triggerGameOverFlash() {
    this.flashDuration = GAME_OVER_FLASH_DURATION;
    this.flashTimer = GAME_OVER_FLASH_DURATION;
    this.flashColor.setHex(GAME_OVER_FLASH_COLOR);
  }

  spawnEnemyDeathParticles(position) {
    for (let i = 0; i < PARTICLE_COUNT; i += 1) {
      const angle = randomRange(this.rng, 0, Math.PI * 2);
      const speed = randomRange(this.rng, PARTICLE_MIN_SPEED, PARTICLE_MAX_SPEED);

      const geometry = new THREE.PlaneGeometry(0.12, 0.12);
      const material = new THREE.MeshBasicMaterial({
        color: 0xe63946,
        side: THREE.DoubleSide,
        transparent: true,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.copy(position);
      mesh.position.y = 0.05;
      this.scene.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, 0, Math.sin(angle) * speed),
        lifetime: PARTICLE_LIFETIME,
        age: 0,
      });
    }
  }

  syncBulletTrails(activeBullets) {
    const activeSet = new Set(activeBullets);

    for (const bullet of activeSet) {
      if (!this.bulletTrails.has(bullet)) {
        this.bulletTrails.set(bullet, this.#createTrailForBullet(bullet));
      }
    }

    for (const [bullet, trail] of this.bulletTrails.entries()) {
      if (activeSet.has(bullet)) {
        continue;
      }

      this.#destroyTrail(trail);
      this.bulletTrails.delete(bullet);
    }
  }

  update(deltaSeconds) {
    this.#updateShake(deltaSeconds);
    this.#updateFlash(deltaSeconds);
    this.#updateParticles(deltaSeconds);
    this.#updateTrails();
  }

  applyCameraShake(camera) {
    camera.position.x += this.shakeOffset.x;
    camera.position.z += this.shakeOffset.z;
  }

  destroy() {
    for (const particle of this.particles) {
      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      particle.mesh.material.dispose();
    }
    this.particles.length = 0;

    for (const trail of this.bulletTrails.values()) {
      this.#destroyTrail(trail);
    }
    this.bulletTrails.clear();

    this.renderer.setClearColor(this.defaultColor, 1);
  }

  #createTrailForBullet(bullet) {
    const color = bullet.mesh.material.color.getHex();
    const size = bullet.size ?? 0.15;
    const ghosts = TRAIL_OPACITIES.map((opacity) => {
      const geometry = new THREE.PlaneGeometry(size, size);
      const material = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
      });
      const ghost = new THREE.Mesh(geometry, material);
      ghost.rotation.x = -Math.PI / 2;
      ghost.visible = false;
      this.scene.add(ghost);
      return ghost;
    });

    const history = [
      bullet.mesh.position.clone(),
      bullet.mesh.position.clone(),
      bullet.mesh.position.clone(),
      bullet.mesh.position.clone(),
    ];

    return {
      bullet,
      ghosts,
      history,
    };
  }

  #destroyTrail(trail) {
    for (const ghost of trail.ghosts) {
      this.scene.remove(ghost);
      ghost.geometry.dispose();
      ghost.material.dispose();
    }
  }

  #updateShake(deltaSeconds) {
    if (this.shakeTimer <= 0) {
      this.shakeOffset.set(0, 0, 0);
      this.shakeIntensity = 0;
      return;
    }

    this.shakeTimer = Math.max(0, this.shakeTimer - deltaSeconds);
    const t = this.shakeTimer / SHAKE_DURATION;
    const magnitude = this.shakeIntensity * t;

    this.shakeOffset.x = (Math.random() * 2 - 1) * magnitude;
    this.shakeOffset.z = (Math.random() * 2 - 1) * magnitude;
  }

  #updateFlash(deltaSeconds) {
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - deltaSeconds);
      this.renderer.setClearColor(this.flashColor, 1);
      return;
    }

    this.renderer.setClearColor(this.defaultColor, 1);
    this.flashDuration = 0;
  }

  #updateParticles(deltaSeconds) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const particle = this.particles[i];
      particle.age += deltaSeconds;

      const lifeT = Math.min(1, particle.age / particle.lifetime);
      particle.mesh.position.addScaledVector(particle.velocity, deltaSeconds);
      particle.mesh.scale.setScalar(1 - lifeT);
      particle.mesh.material.opacity = 1 - lifeT;

      if (particle.age < particle.lifetime) {
        continue;
      }

      this.scene.remove(particle.mesh);
      particle.mesh.geometry.dispose();
      particle.mesh.material.dispose();
      this.particles.splice(i, 1);
    }
  }

  #updateTrails() {
    for (const trail of this.bulletTrails.values()) {
      const current = trail.bullet.mesh.position.clone();
      trail.history.unshift(current);
      if (trail.history.length > 4) {
        trail.history.length = 4;
      }

      for (let i = 0; i < trail.ghosts.length; i += 1) {
        const ghost = trail.ghosts[i];
        const sample = trail.history[i + 1];

        if (!sample) {
          ghost.visible = false;
          continue;
        }

        ghost.visible = true;
        ghost.position.set(sample.x, sample.y, sample.z);
      }
    }
  }
}
