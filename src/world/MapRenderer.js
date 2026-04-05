import * as THREE from "three";
import { CELL_TYPES } from "./MapGenerator.js";

const FLOOR_COLOR = 0x0d0d1a;
const WALL_TOP_COLOR = 0x2a2a4a;
const WALL_SIDE_COLOR = 0x1a1a3a;

function cellToWorldPosition(cellX, cellY, gridWidth, gridHeight) {
  return {
    x: cellX - gridWidth / 2 + 0.5,
    z: cellY - gridHeight / 2 + 0.5,
  };
}

export class MapRenderer {
  constructor(scene, _rng) {
    this.scene = scene;

    this.floorGeometry = new THREE.PlaneGeometry(1, 1);
    this.floorMaterial = new THREE.MeshBasicMaterial({ color: FLOOR_COLOR });

    this.wallGeometry = new THREE.BoxGeometry(1, 2.0, 1);
    this.wallMaterials = [
      new THREE.MeshLambertMaterial({
        color: WALL_SIDE_COLOR,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshLambertMaterial({
        color: WALL_SIDE_COLOR,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshLambertMaterial({
        color: WALL_TOP_COLOR,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshLambertMaterial({
        color: WALL_SIDE_COLOR,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshLambertMaterial({
        color: WALL_SIDE_COLOR,
        side: THREE.DoubleSide,
      }),
      new THREE.MeshLambertMaterial({
        color: WALL_SIDE_COLOR,
        side: THREE.DoubleSide,
      }),
    ];
  }

  render(mapData) {
    const floorMeshes = [];
    const wallMeshes = [];
    const platformMeshes = [];

    const height = mapData.grid.length;
    const width = mapData.grid[0]?.length ?? 0;

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const cellType = mapData.grid[y][x];
        const worldPos = cellToWorldPosition(x, y, width, height);

        if (cellType === CELL_TYPES.FLOOR) {
          const floorMesh = new THREE.Mesh(
            this.floorGeometry,
            this.floorMaterial,
          );
          floorMesh.rotation.x = -Math.PI / 2;
          floorMesh.position.set(worldPos.x, 0, worldPos.z);
          this.scene.add(floorMesh);
          floorMeshes.push(floorMesh);

          continue;
        }

        const wallMesh = new THREE.Mesh(this.wallGeometry, this.wallMaterials);
        wallMesh.position.set(worldPos.x, 1.0, worldPos.z);
        this.scene.add(wallMesh);
        wallMeshes.push(wallMesh);
      }
    }

    return {
      wallMeshes,
      floorMeshes,
      platformMeshes,
      playerSpawn: mapData.playerSpawn,
    };
  }
}
