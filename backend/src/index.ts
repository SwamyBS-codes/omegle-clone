import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";

const app = express();
const server = http.createServer(app);

const io = new Server(server);

io.on("connection", (socket: Socket) => {
  console.log("User connected:", socket.id);
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});