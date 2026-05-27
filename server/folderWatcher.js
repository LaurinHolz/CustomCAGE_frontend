import express from "express";
import http from "http";
import { Server } from "socket.io";
import chokidar from "chokidar";
import fs from "fs/promises";
import path from "path";
import cors from "cors";

const WATCH_FOLDER = "../data/watchdog";

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

async function readDataFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const content = await fs.readFile(filePath, "utf8");

  if (ext === ".json") {
    return JSON.parse(content);
  }

  if (ext === ".csv") {
    const lines = content.trim().split("\n");
    const headers = lines[0].split(",");

    return lines.slice(1).map((line) => {
      const values = line.split(",");

      return headers.reduce((obj, header, index) => {
        const raw = values[index];
        const num = Number(raw);
        obj[header.trim()] = Number.isNaN(num) ? raw : num;
        return obj;
      }, {});
    });
  }

  return { raw: content };
}

function waitUntilFileIsReady(filePath, retries = 10, delayMs = 200) {
  return new Promise((resolve, reject) => {
    let lastSize = -1;
    let attempts = 0;

    const check = async () => {
      try {
        const stats = await fs.stat(filePath);

        if (stats.size === lastSize) {
          resolve();
          return;
        }

        lastSize = stats.size;
        attempts += 1;

        if (attempts >= retries) {
          resolve();
          return;
        }

        setTimeout(check, delayMs);
      } catch (err) {
        reject(err);
      }
    };

    check();
  });
}

const watcher = chokidar.watch(WATCH_FOLDER, {
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 500,
    pollInterval: 100,
  },
});

watcher.on("add", async (filePath) => {
  try {
    await waitUntilFileIsReady(filePath);

    const data = await readDataFile(filePath);

    io.emit("new-file", {
      filename: path.basename(filePath),
      path: filePath,
      data,
      createdAt: new Date().toISOString(),
    });

    console.log("New file detected:", filePath);
  } catch (err) {
    console.error("Failed to process file:", filePath, err);
  }
});

io.on("connection", (socket) => {
  console.log("React client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("React client disconnected:", socket.id);
  });
});

server.listen(4000, () => {
  console.log("Folder watcher running on http://localhost:4000");
  console.log("Watching:", WATCH_FOLDER);
});