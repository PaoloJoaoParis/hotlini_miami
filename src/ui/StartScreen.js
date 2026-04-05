export class StartScreen {
  constructor(onStart) {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: #0a0a0f;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      font-family: 'Courier New', monospace;
    `;
    this.container.innerHTML = `
      <div style="
        color: #cc0000;
        font-size: 64px;
        font-weight: bold;
        letter-spacing: 16px;
        text-shadow: 0 0 40px #ff0000, 0 0 80px #ff000055;
        margin-bottom: 8px;
      ">HOTLINE</div>
      
      <button id="start-btn" style="
        background: transparent;
        border: 2px solid #cc0000;
        color: #cc0000;
        font-family: 'Courier New', monospace;
        font-size: 18px;
        letter-spacing: 6px;
        padding: 16px 48px;
        cursor: pointer;
        transition: all 0.2s;
        text-transform: uppercase;
      ">NOUVELLE PARTIE</button>
      
    `;
    document.body.appendChild(this.container);

    const btn = this.container.querySelector("#start-btn");
    btn.addEventListener("mouseover", () => {
      btn.style.background = "#cc0000";
      btn.style.color = "#000";
    });
    btn.addEventListener("mouseout", () => {
      btn.style.background = "transparent";
      btn.style.color = "#cc0000";
    });
    btn.addEventListener("click", () => {
      this.hide();
      onStart();
    });
  }

  hide() {
    this.container.style.transition = "opacity 0.4s ease";
    this.container.style.opacity = "0";
    setTimeout(() => this.container.remove(), 400);
  }
}
