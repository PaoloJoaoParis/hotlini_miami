export class DeathScreen {
  constructor(onRestart) {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      font-family: 'Courier New', monospace;
      transition: background 0.8s ease;
    `;
    this.container.innerHTML = `
      <div style="
        color: #cc0000;
        font-size: 72px;
        font-weight: bold;
        letter-spacing: 12px;
        text-shadow: 0 0 30px #ff0000;
        opacity: 0;
        transition: opacity 0.5s ease;
        margin-bottom: 32px;
      " id="death-title">VOUS ÊTES MORT</div>
      <button id="restart-btn" style="
        background: transparent;
        border: 2px solid #cc0000;
        color: #cc0000;
        font-family: 'Courier New', monospace;
        font-size: 18px;
        letter-spacing: 6px;
        padding: 16px 48px;
        cursor: pointer;
        transition: all 0.2s;
        opacity: 0;
        transition: opacity 0.8s ease 0.4s;
        text-transform: uppercase;
      ">RECOMMENCER</button>
    `;
    document.body.appendChild(this.container);

    const btn = this.container.querySelector("#restart-btn");
    btn.addEventListener("mouseover", () => {
      btn.style.background = "#cc0000";
      btn.style.color = "#000";
    });
    btn.addEventListener("mouseout", () => {
      btn.style.background = "transparent";
      btn.style.color = "#cc0000";
    });
    btn.addEventListener("click", () => {
      onRestart();
    });
  }

  show() {
    setTimeout(() => {
      this.container.style.background = "rgba(0,0,0,1)";
      const title = this.container.querySelector("#death-title");
      const btn = this.container.querySelector("#restart-btn");
      setTimeout(() => {
        title.style.opacity = "1";
        btn.style.opacity = "1";
      }, 100);
    }, 10);
  }

  destroy() {
    this.container.remove();
  }
}
