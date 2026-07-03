import type { Socket } from "socket.io";

export interface Participant {
  id: string;
  name: string;
  socket: Socket;
}

export interface Room {
  roomId: string;
  participants: Participant[];
}

export class RoomManager {
  private rooms: Map<string, Room>;

  constructor() {
    this.rooms = new Map();
  }

  joinRoom(roomId: string, name: string, socket: Socket) {
    let room = this.rooms.get(roomId);
    
    if (!room) {
      room = { roomId, participants: [] };
      this.rooms.set(roomId, room);
    }

    if (room.participants.length >= 2) {
      socket.emit("room-full");
      return;
    }

    const newParticipant: Participant = {
      id: socket.id,
      name,
      socket,
    };

    room.participants.push(newParticipant);
    console.log(`User ${name} (${socket.id}) joined room ${roomId}`);

    if (room.participants.length === 2) {
      const p1 = room.participants[0];
      const p2 = room.participants[1];

      // Notify p1 (creator) to initiate offer
      p1.socket.emit("send-offer", {
        roomId,
        strangerName: p2.name,
      });

      // Notify p2 that they have joined and matched with p1
      p2.socket.emit("matched", {
        roomId,
        strangerName: p1.name,
      });
    }
  }

  leaveRoom(socketId: string) {
    for (const room of this.rooms.values()) {
      const index = room.participants.findIndex(p => p.id === socketId);
      if (index !== -1) {
        const leavingUser = room.participants[index];
        room.participants.splice(index, 1);
        console.log(`User ${leavingUser.name} (${socketId}) left room ${room.roomId}`);

        // Notify other user if they are still there
        if (room.participants.length > 0) {
          const otherUser = room.participants[0];
          otherUser.socket.emit("peer-left");
        } else {
          // Delete room if empty
          this.rooms.delete(room.roomId);
        }
        break;
      }
    }
  }

  onOffer(roomId: string, senderId: string, sdp: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const target = room.participants.find(p => p.id !== senderId);
    if (target) {
      target.socket.emit("offer", {
        offer: sdp,
        roomId,
        strangerName: room.participants.find(p => p.id === senderId)?.name || "Stranger",
      });
    }
  }

  onAnswer(roomId: string, senderId: string, sdp: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const target = room.participants.find(p => p.id !== senderId);
    if (target) {
      target.socket.emit("answer", {
        answer: sdp,
        roomId,
      });
    }
  }

  onIceCandidate(roomId: string, senderId: string, candidate: any) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const target = room.participants.find(p => p.id !== senderId);
    if (target) {
      target.socket.emit("ice-candidate", {
        candidate,
        roomId,
      });
    }
  }

  onMessage(roomId: string, senderId: string, message: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const target = room.participants.find(p => p.id !== senderId);
    if (target) {
      target.socket.emit("message", {
        text: message,
        sender: "stranger",
      });
    }
  }

  onTyping(roomId: string, senderId: string, typing: boolean) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const target = room.participants.find(p => p.id !== senderId);
    if (target) {
      target.socket.emit("typing", { typing });
    }
  }

  getOnlineCount() {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.participants.length;
    }
    return count;
  }
}