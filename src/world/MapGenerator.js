export const CELL_TYPES = {
  FLOOR: 0,
  WALL: 1,
};

const MAP_WIDTH = 40;
const MAP_HEIGHT = 40;

const MIN_ROOM_COUNT = 6;
const MAX_ROOM_COUNT = 10;
const MIN_ROOM_WIDTH = 4;
const MAX_ROOM_WIDTH = 10;
const MIN_ROOM_HEIGHT = 4;
const MAX_ROOM_HEIGHT = 8;
const MAX_PLACEMENT_ATTEMPTS = 200;

function randomIntInclusive(rng, min, max) {
  return Math.floor(rng.between(min, max + 1));
}

function createGrid(width, height, fillValue) {
  const grid = new Array(height);

  for (let y = 0; y < height; y += 1) {
    grid[y] = new Array(width).fill(fillValue);
  }

  return grid;
}

function roomsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function carveRoom(grid, room) {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      grid[y][x] = CELL_TYPES.FLOOR;
    }
  }
}

function carveHorizontalCorridor(grid, xFrom, xTo, y) {
  const start = Math.min(xFrom, xTo);
  const end = Math.max(xFrom, xTo);

  for (let x = start; x <= end; x += 1) {
    grid[y][x] = CELL_TYPES.FLOOR;
  }
}

function carveVerticalCorridor(grid, yFrom, yTo, x) {
  const start = Math.min(yFrom, yTo);
  const end = Math.max(yFrom, yTo);

  for (let y = start; y <= end; y += 1) {
    grid[y][x] = CELL_TYPES.FLOOR;
  }
}

function roomCenter(room) {
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2),
  };
}

function connectRoomsWithCorridor(grid, roomA, roomB) {
  const centerA = roomCenter(roomA);
  const centerB = roomCenter(roomB);

  carveHorizontalCorridor(grid, centerA.x, centerB.x, centerA.y);
  carveVerticalCorridor(grid, centerA.y, centerB.y, centerB.x);
}

export class MapGenerator {
  constructor(rng, options = {}) {
    this.rng = rng;
    this.width = options.width ?? MAP_WIDTH;
    this.height = options.height ?? MAP_HEIGHT;
  }

  generate() {
    const grid = createGrid(this.width, this.height, CELL_TYPES.WALL);
    const rooms = [];
    const targetRoomCount = randomIntInclusive(
      this.rng,
      MIN_ROOM_COUNT,
      MAX_ROOM_COUNT,
    );

    let attempts = 0;
    while (
      rooms.length < targetRoomCount &&
      attempts < MAX_PLACEMENT_ATTEMPTS
    ) {
      attempts += 1;

      const width = randomIntInclusive(
        this.rng,
        MIN_ROOM_WIDTH,
        MAX_ROOM_WIDTH,
      );
      const height = randomIntInclusive(
        this.rng,
        MIN_ROOM_HEIGHT,
        MAX_ROOM_HEIGHT,
      );

      const maxX = this.width - width - 1;
      const maxY = this.height - height - 1;

      if (maxX < 1 || maxY < 1) {
        break;
      }

      const room = {
        x: randomIntInclusive(this.rng, 1, maxX),
        y: randomIntInclusive(this.rng, 1, maxY),
        width,
        height,
      };

      const overlaps = rooms.some((existingRoom) =>
        roomsOverlap(room, existingRoom),
      );
      if (overlaps) {
        continue;
      }

      carveRoom(grid, room);

      if (rooms.length > 0) {
        connectRoomsWithCorridor(grid, rooms[rooms.length - 1], room);
      }

      rooms.push(room);
    }

    if (rooms.length === 0) {
      const fallbackRoom = {
        x: Math.floor(this.width / 2) - 2,
        y: Math.floor(this.height / 2) - 2,
        width: 4,
        height: 4,
      };
      carveRoom(grid, fallbackRoom);
      rooms.push(fallbackRoom);
    }

    const firstCenter = roomCenter(rooms[0]);
    const playerSpawn = {
      x: firstCenter.x,
      z: firstCenter.y,
    };

    return { grid, rooms, playerSpawn };
  }
}
