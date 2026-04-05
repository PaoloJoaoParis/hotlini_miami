import { Game } from "./core/Game.js";

const root = document.querySelector("#app");

if (!root) {
  throw new Error("Missing #app root element");
}

const game = new Game(root);
game.start();
