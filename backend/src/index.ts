import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import { userManager } from "./manager/userManager.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server,{
    cors:{
        origin:"*",
    },
});

const userMgr = new userManager();
io.on("connection", (socket: Socket) => {
  console.log("User connected:", socket.id);
  userMgr.addUser("random", socket);

  socket.on("disconnect", () => {
    userMgr.removeUser(socket.id);
  });
});

server.listen(3000, () => {
  console.log("Server running on port 3000");
});