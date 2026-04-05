import * as THREE from "three";

export const VISIBLE_HEIGHT = 16;
export const CAMERA_FOLLOW_OFFSET = new THREE.Vector3(0, 12, 3.2);

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

  camera.position.copy(CAMERA_FOLLOW_OFFSET);
  camera.lookAt(0, 0, 0);

  return camera;
}

export function updateTopDownCameraFollow(camera, targetPosition) {
  camera.position.set(
    targetPosition.x + CAMERA_FOLLOW_OFFSET.x,
    targetPosition.y + CAMERA_FOLLOW_OFFSET.y,
    targetPosition.z + CAMERA_FOLLOW_OFFSET.z,
  );
  camera.lookAt(targetPosition.x, targetPosition.y, targetPosition.z);
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
