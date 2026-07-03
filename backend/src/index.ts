import express from "express";
// Lightweight manual CORS handling to ensure polling requests receive headers
// (avoids adding a new dependency in this quick patch)
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { RoomManager } from "./roomManager.js";

const app = express();

const allowedOrigins = new Set([
  "https://omegle-clone-weld.vercel.app",
  "https://omegle-clone-green.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

// Simple CORS middleware to add required headers for XHR polling
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  } else {
    res.header("Access-Control-Allow-Origin", "*");
  }
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

const server = createServer(app);

// Ensure every HTTP response includes CORS headers (covers Socket.IO polling responses)
server.on("request", (req, res) => {
  try {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  } catch (e) {
    // ignore if headers already sent
  }
});

// Socket.IO CORS config: allow the known frontend origins
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const roomManager = new RoomManager();

io.on("connection", (socket: Socket) => {
  console.log(`User socket connected: ${socket.id}`);

  io.emit("online-count", roomManager.getOnlineCount());

  socket.on("join-room", ({ roomId, name }) => {
    roomManager.joinRoom(roomId, name, socket);
    io.emit("online-count", roomManager.getOnlineCount());
  });

  socket.on("offer", ({ sdp, roomId }) => {
    roomManager.onOffer(roomId, socket.id, sdp);
  });

  socket.on("answer", ({ sdp, roomId }) => {
    roomManager.onAnswer(roomId, socket.id, sdp);
  });

  socket.on("ice-candidate", ({ candidate, roomId }) => {
    roomManager.onIceCandidate(roomId, socket.id, candidate);
  });

  socket.on("send-message", ({ message, roomId }) => {
    roomManager.onMessage(roomId, socket.id, message);
  });

  socket.on("typing", ({ typing, roomId }) => {
    roomManager.onTyping(roomId, socket.id, typing);
  });

  socket.on("disconnect", () => {
    console.log(`User socket disconnected: ${socket.id}`);
    roomManager.leaveRoom(socket.id);
    io.emit("online-count", roomManager.getOnlineCount());
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});