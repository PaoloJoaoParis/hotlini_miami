export class Crosshair {
  constructor() {
    const img = document.createElement("img");
    img.id = "crosshair-img";
    img.style.cssText = `
			position: fixed;
			pointer-events: none;
			z-index: 9999;
			width: 64px;
			height: 64px;
			image-rendering: pixelated;
			transform: translate(-50%, -50%);
		`;
    document.body.appendChild(img);
    this.img = img;
    this.currentState = null;
    this.setState(1);
  }

  setState(n) {
    if (this.currentState === n) {
      return;
    }

    this.currentState = n;
    this.img.src = `/assets/crosshair/state${n}.png`;
  }

  update(mouseX, mouseY, chargeRatio) {
    this.img.style.left = mouseX + "px";
    this.img.style.top = mouseY + "px";
    const state = Math.floor(chargeRatio * 4) + 1;
    this.setState(Math.min(state, 4));
  }

  destroy() {
    this.img.remove();
  }
}
