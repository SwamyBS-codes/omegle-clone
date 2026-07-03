import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { RoomManager } from "./roomManager.js";

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const roomManager = new RoomManager();

io.on("connection", (socket: Socket) => {
  console.log(`User socket connected: ${socket.id}`);
  
  // Broadcast active online count on connection
  io.emit("online-count", roomManager.getOnlineCount());

  // Join a direct room
  socket.on("join-room", ({ roomId, name }: { roomId: string; name: string }) => {
    roomManager.joinRoom(roomId, name, socket);
    io.emit("online-count", roomManager.getOnlineCount());
  });

  // WebRTC Signaling Events
  socket.on("offer", ({ sdp, roomId }: { sdp: string; roomId: string }) => {
    roomManager.onOffer(roomId, socket.id, sdp);
  });

  socket.on("answer", ({ sdp, roomId }: { sdp: string; roomId: string }) => {
    roomManager.onAnswer(roomId, socket.id, sdp);
  });

  socket.on("ice-candidate", ({ candidate, roomId }: { candidate: any; roomId: string }) => {
    roomManager.onIceCandidate(roomId, socket.id, candidate);
  });

  // Text Message Event
  socket.on("send-message", ({ message, roomId }: { message: string; roomId: string }) => {
    roomManager.onMessage(roomId, socket.id, message);
  });

  // Typing Status Event
  socket.on("typing", ({ typing, roomId }: { typing: boolean; roomId: string }) => {
    roomManager.onTyping(roomId, socket.id, typing);
  });

  // Socket Disconnection
  socket.on("disconnect", () => {
    console.log(`User socket disconnected: ${socket.id}`);
    roomManager.leaveRoom(socket.id);
    io.emit("online-count", roomManager.getOnlineCount());
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});