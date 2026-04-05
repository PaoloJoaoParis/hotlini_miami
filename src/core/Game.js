import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectsManager } from "../effects/EffectsManager.js";
import { Enemy } from "../entities/Enemy.js";
import { EnemyBullet } from "../entities/EnemyBullet.js";
import { Player } from "../entities/Player.js";
import { Crosshair } from "../ui/Crosshair.js";
import { RNG } from "../utils/RNG.js";
import { CELL_TYPES, MapGenerator } from "../world/MapGenerator.js";
import { MapRenderer } from "../world/MapRenderer.js";
import {
  createTopDownCamera,
  resizeTopDownCamera,
  updateTopDownCameraFollow,
} from "./Camera.js";
import { Renderer } from "./Renderer.js";

const PLAYER_HALF_SIZE = 0.4;
const ENEMY_HIT_RADIUS = 0.4;
const PLAYER_HIT_RADIUS = 0.4;

export class Game {
  constructor(container) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x101010);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = createTopDownCamera(aspect);
    this.renderer = new Renderer(container);

    this.rng = new RNG(1337);
    this.mapGenerator = new MapGenerator(this.rng);
    this.mapData = this.mapGenerator.generate();
    this.mapRenderer = new MapRenderer(this.scene, this.rng);
    const renderedMap = this.mapRenderer.render(this.mapData);

    this.wallMeshes = renderedMap.wallMeshes;
    this.floorMeshes = renderedMap.floorMeshes;
    this.platformMeshes = renderedMap.platformMeshes;
    this.grid = this.mapData.grid;
    this.rooms = this.mapData.rooms;
    this.gridHeight = this.grid.length;
    this.gridWidth = this.grid[0]?.length ?? 0;

    const spawn = renderedMap.playerSpawn;
    const worldSpawn = this.#gridToWorld(spawn.x, spawn.z);

    this.player = new Player();
    this.scene.add(this.player.mesh);
    this.player.position.set(worldSpawn.x, 0.02, worldSpawn.z);
    updateTopDownCameraFollow(this.camera, this.player.position);

    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.playerAlive = true;
    this.keys = new Set();
    this.mouseWorldPos = null;
    this.mouseScreenX = window.innerWidth * 0.5;
    this.mouseScreenY = window.innerHeight * 0.5;

    this.raycaster = new THREE.Raycaster();
    this.mouseNdc = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.mouseHitPoint = new THREE.Vector3();

    this.effects = new EffectsManager(
      this.scene,
      this.renderer.renderer,
      this.rng,
    );
    this.crosshair = new Crosshair();

    this.orbitControls = new OrbitControls(
      this.camera,
      this.renderer.renderer.domElement,
    );
    this.orbitControls.enabled = false;
    this.orbitControls.enableRotate = true;
    this.orbitControls.enablePan = false;
    this.orbitControls.enableZoom = false;
    this.orbitControls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this.orbitControls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    this.orbitControls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    this.isOrbiting = false;

    this.lastTime = performance.now();
    this.rafId = null;

    this.onResize = () => this.#onResize();
    this.onKeyDown = (event) => this.#onKeyDown(event);
    this.onKeyUp = (event) => this.#onKeyUp(event);
    this.onMouseMove = (event) => this.#onMouseMove(event);
    this.onMouseDown = (event) => this.#onMouseDown(event);
    this.onMouseUp = (event) => this.#onMouseUp(event);
    this.onContextMenu = (event) => this.#onContextMenu(event);
    this.loop = (now) => this.#loop(now);

    this.#spawnEnemies();
  }

  start() {
    document.body.style.cursor = "none";
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("contextmenu", this.onContextMenu);
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("contextmenu", this.onContextMenu);

    for (const bullet of this.bullets) {
      bullet.destroy(this.scene);
    }
    this.bullets.length = 0;

    for (const enemyBullet of this.enemyBullets) {
      enemyBullet.destroy(this.scene);
    }
    this.enemyBullets.length = 0;

    for (const enemy of this.enemies) {
      enemy.destroy(this.scene);
    }
    this.enemies.length = 0;

    this.effects.destroy();
    this.crosshair.destroy();
    this.orbitControls.dispose();
    document.body.style.cursor = "";

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  #onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    resizeTopDownCamera(this.camera, aspect);
    this.renderer.resize(width, height);
  }

  #onKeyDown(event) {
    this.keys.add(event.code);
  }

  #onKeyUp(event) {
    this.keys.delete(event.code);
  }

  #onMouseMove(event) {
    this.mouseScreenX = event.clientX;
    this.mouseScreenY = event.clientY;

    const canvas = this.renderer.renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    this.mouseNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseNdc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(
      this.groundPlane,
      this.mouseHitPoint,
    );

    if (hit) {
      this.mouseWorldPos = this.mouseHitPoint.clone();
    }
  }

  #onMouseDown(event) {
    if (event.button === 2) {
      event.preventDefault();
      this.isOrbiting = true;
      this.orbitControls.target.copy(this.player.position);
      this.orbitControls.enabled = true;
      return;
    }

    if (event.button !== 0 || !this.playerAlive) {
      return;
    }

    this.player.onMouseDown();
  }

  #onMouseUp(event) {
    if (event.button === 2) {
      this.isOrbiting = false;
      this.orbitControls.enabled = false;
      updateTopDownCameraFollow(this.camera, this.player.position);
      return;
    }

    if (event.button !== 0 || !this.playerAlive) {
      return;
    }

    this.player.onMouseUp(this.scene, this.bullets);
  }

  #onContextMenu(event) {
    event.preventDefault();
  }

  #spawnEnemies() {
    if (!Array.isArray(this.rooms) || this.rooms.length <= 1) {
      return;
    }

    for (let i = 1; i < this.rooms.length; i += 1) {
      const room = this.rooms[i];
      const centerCellX = Math.floor(room.x + room.width / 2);
      const centerCellY = Math.floor(room.y + room.height / 2);
      const worldCenter = this.#gridToWorld(centerCellX, centerCellY);

      const enemy = new Enemy(room, this.gridWidth, this.gridHeight, this.rng);
      enemy.position.set(worldCenter.x, 0.02, worldCenter.z);
      this.scene.add(enemy.mesh);
      this.enemies.push(enemy);
    }
  }

  #loop(now) {
    const deltaSeconds = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.update(deltaSeconds);
    this.render();

    this.rafId = requestAnimationFrame(this.loop);
  }

  #gridToWorld(cellX, cellY) {
    return {
      x: cellX - this.gridWidth / 2 + 0.5,
      z: cellY - this.gridHeight / 2 + 0.5,
    };
  }

  #worldToGrid(worldX, worldZ) {
    return {
      x: Math.floor(worldX + this.gridWidth / 2),
      y: Math.floor(worldZ + this.gridHeight / 2),
    };
  }

  #isWallAtWorld(worldX, worldZ) {
    const cell = this.#worldToGrid(worldX, worldZ);

    if (
      cell.x < 0 ||
      cell.y < 0 ||
      cell.x >= this.gridWidth ||
      cell.y >= this.gridHeight
    ) {
      return true;
    }

    return this.grid[cell.y][cell.x] === CELL_TYPES.WALL;
  }

  #playerOverlapsWall(worldX, worldZ) {
    return (
      this.#isWallAtWorld(
        worldX - PLAYER_HALF_SIZE,
        worldZ - PLAYER_HALF_SIZE,
      ) ||
      this.#isWallAtWorld(
        worldX + PLAYER_HALF_SIZE,
        worldZ - PLAYER_HALF_SIZE,
      ) ||
      this.#isWallAtWorld(
        worldX - PLAYER_HALF_SIZE,
        worldZ + PLAYER_HALF_SIZE,
      ) ||
      this.#isWallAtWorld(worldX + PLAYER_HALF_SIZE, worldZ + PLAYER_HALF_SIZE)
    );
  }

  #resolvePlayerWallCollision(previousX, previousZ) {
    const currentX = this.player.position.x;
    const currentZ = this.player.position.z;

    if (!this.#playerOverlapsWall(currentX, currentZ)) {
      return;
    }

    if (this.#playerOverlapsWall(currentX, previousZ)) {
      this.player.position.x = previousX;
    }

    if (this.#playerOverlapsWall(this.player.position.x, currentZ)) {
      this.player.position.z = previousZ;
    }
  }

  #handleBulletEnemyCollisions() {
    for (let b = this.bullets.length - 1; b >= 0; b -= 1) {
      const bullet = this.bullets[b];
      const bulletPos = bullet.mesh.position;
      let bulletConsumed = false;

      for (let e = this.enemies.length - 1; e >= 0; e -= 1) {
        const enemy = this.enemies[e];
        if (!enemy.isAlive()) {
          continue;
        }

        const distance = Math.hypot(
          bulletPos.x - enemy.position.x,
          bulletPos.z - enemy.position.z,
        );

        if (distance <= ENEMY_HIT_RADIUS) {
          enemy.kill();
          this.effects.spawnEnemyDeathParticles(enemy.position);
          this.effects.triggerKillFlash();
          this.effects.shake();
          bulletConsumed = true;
          break;
        }
      }

      if (bulletConsumed) {
        bullet.destroy(this.scene);
        this.bullets.splice(b, 1);
      }
    }
  }

  #handleEnemyPlayerCollision() {
    if (!this.playerAlive) {
      return;
    }

    for (const enemy of this.enemies) {
      if (!enemy.isAlive()) {
        continue;
      }

      const distance = Math.hypot(
        enemy.position.x - this.player.position.x,
        enemy.position.z - this.player.position.z,
      );

      if (distance <= PLAYER_HIT_RADIUS) {
        this.playerAlive = false;
        this.effects.triggerKillFlash();
        this.effects.triggerGameOverFlash();
        this.effects.shake();
        console.log("GAME OVER");
        return;
      }
    }
  }

  #handleEnemyBulletPlayerCollision() {
    if (!this.playerAlive) {
      return;
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const enemyBullet = this.enemyBullets[i];
      const distance = Math.hypot(
        enemyBullet.mesh.position.x - this.player.position.x,
        enemyBullet.mesh.position.z - this.player.position.z,
      );

      if (distance <= PLAYER_HIT_RADIUS) {
        this.playerAlive = false;
        this.effects.triggerKillFlash();
        this.effects.triggerGameOverFlash();
        this.effects.shake();
        console.log("GAME OVER");
        enemyBullet.destroy(this.scene);
        this.enemyBullets.splice(i, 1);
        return;
      }
    }
  }

  #removeDeadEnemies() {
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = this.enemies[i];
      if (enemy.isAlive()) {
        continue;
      }

      enemy.destroy(this.scene);
      this.enemies.splice(i, 1);
    }
  }

  update(deltaSeconds) {
    if (this.playerAlive) {
      const previousX = this.player.position.x;
      const previousZ = this.player.position.z;

      this.player.update(deltaSeconds, this.keys, this.mouseWorldPos);
      this.#resolvePlayerWallCollision(previousX, previousZ);
    }

    for (let i = this.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = this.bullets[i];
      bullet.update(deltaSeconds, this.wallMeshes);

      if (!bullet.isAlive()) {
        if (bullet.consumeWallImpact()) {
          this.effects.shake();
        }
        bullet.destroy(this.scene);
        this.bullets.splice(i, 1);
      }
    }

    for (let i = this.enemyBullets.length - 1; i >= 0; i -= 1) {
      const enemyBullet = this.enemyBullets[i];
      enemyBullet.update(deltaSeconds, this.wallMeshes);

      if (!enemyBullet.isAlive()) {
        if (enemyBullet.consumeWallImpact()) {
          this.effects.shake();
        }
        enemyBullet.destroy(this.scene);
        this.enemyBullets.splice(i, 1);
      }
    }

    for (const enemy of this.enemies) {
      const enemyShot = enemy.update(
        deltaSeconds,
        this.player.position,
        this.grid,
        this.bullets,
      );

      if (enemyShot && this.playerAlive) {
        const enemyBullet = new EnemyBullet(
          this.scene,
          enemyShot.position,
          enemyShot.direction,
        );
        this.enemyBullets.push(enemyBullet);
      }
    }

    this.#handleBulletEnemyCollisions();
    this.#handleEnemyPlayerCollision();
    this.#handleEnemyBulletPlayerCollision();
    this.#removeDeadEnemies();

    this.effects.syncBulletTrails([...this.bullets, ...this.enemyBullets]);
    this.effects.update(deltaSeconds);
    this.crosshair.update(
      this.mouseScreenX,
      this.mouseScreenY,
      this.player.getChargeRatio(),
    );

    if (this.isOrbiting) {
      this.orbitControls.target.copy(this.player.position);
      this.orbitControls.update();
    } else {
      updateTopDownCameraFollow(this.camera, this.player.position);
    }

    this.effects.applyCameraShake(this.camera);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
