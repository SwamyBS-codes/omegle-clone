import type { User } from "./manager/userManager.js";

interface Room {
    user1: User;
    user2: User;
    roomId: string;
}

export class RoomManager {
    private rooms: Map<string, Room>;


    constructor() {
        this.rooms = new Map();
    }

    createRoom(user1: User, user2: User) {
        const roomId = this.generate().toString();

        this.rooms.set(roomId, {
            user1,
            user2,
            roomId
        });

        user1.socket.emit("new-room", {
            type: "send-offer",
            roomId
        });
    }

    onOffer(roomId:string,sdp:string)
    {
        const user2=this.rooms.get(roomId)?.user2;
        user2?.socket.emit("offer",{
            sdp
        })
    }

     onAnswer(roomId:string,sdp:string)
    {
        const user1=this.rooms.get(roomId)?.user1;
        user1?.socket.emit("offer",{
            sdp
        })
    }
    generate() {
        return "1234";
    }
}