import * as THREE from "three";

export const VISIBLE_HEIGHT = 16;

export function createTopDownCamera(aspect) {
  const halfHeight = VISIBLE_HEIGHT * 0.5;
  const halfWidth = halfHeight * aspect;

  const camera = new THREE.OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    0.1,
    100,
  );

  camera.snapIndex = 0;
  camera.currentAzimuth = 0;
  camera.onKeyDown = (key) => {
    if (key === "a") {
      camera.snapIndex = (camera.snapIndex + 1) % 4;
    }
    if (key === "e") {
      camera.snapIndex = (camera.snapIndex - 1 + 4) % 4;
    }
  };

  updateTopDownCameraFollow(camera, new THREE.Vector3(0, 0, 0), 1 / 60);
  camera.lookAt(0, 0, 0);

  return camera;
}

export function updateTopDownCameraFollow(
  camera,
  playerPos,
  frameDelta = 1 / 60,
) {
  const targetAzimuth = camera.snapIndex * (Math.PI / 2) + Math.PI / 4;

  // Normalize currentAzimuth to [0, 2*PI]
  camera.currentAzimuth =
    ((camera.currentAzimuth % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

  // Shortest path delta
  let delta = targetAzimuth - camera.currentAzimuth;
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;

  camera.currentAzimuth += delta * Math.min(1, 10 * frameDelta);

  const radius = 18;
  const height = 14;
  const x = playerPos.x + radius * Math.sin(camera.currentAzimuth);
  const z = playerPos.z + radius * Math.cos(camera.currentAzimuth);

  camera.position.set(x, height, z);
  camera.lookAt(playerPos.x, 0, playerPos.z);
}

export function resizeTopDownCamera(camera, aspect) {
  const halfHeight = VISIBLE_HEIGHT * 0.5;
  const halfWidth = halfHeight * aspect;

  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.updateProjectionMatrix();
}
