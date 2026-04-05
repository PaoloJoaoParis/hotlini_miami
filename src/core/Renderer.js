import * as THREE from "three";

export function setupPixelArtTexture(texture) {
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export class Renderer {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
    });

    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x0b0b0b, 1);

    container.appendChild(this.renderer.domElement);
  }

  resize(width, height) {
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height);
  }

  render(scene, camera) {
    this.renderer.render(scene, camera);
  }
}
