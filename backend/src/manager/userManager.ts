import type { Socket } from "socket.io";
import { RoomManager } from "../roomManager.js";

export interface User
{
    name:string,
    socket:Socket
}
export class userManager
{
    private users:User[]
    private queue:string[]
    private roomManager:RoomManager
    constructor()
    {
        this.users=[];
        this.queue=[]
        this.roomManager=new RoomManager();
    }
    addUser(name:string,socket:Socket)
    {
        this.users.push({
            name,socket
        })
        this.queue.push(socket.id);
        this.clearQueue();
    }
    removeUser(socketId:string)
    {
        this.users=this.users.filter(x=> x.socket.id!==socketId)
        this.queue=this.queue.filter(x=>x!==socketId)
    }
    clearQueue()
    {
        if(this.queue.length <2) 
        {
            return ;
        }
        const person1=this.users.find(x=>x.socket.id===this.queue.pop())
        const person2=this.users.find(x=>x.socket.id===this.queue.pop())
        if(!person1 || !person2) {
            return ;
        }
        const room=this.roomManager.createRoom(person1,person2);
    }


    initHandler(socket: Socket) 
    {
    socket.on(
        "offer",
        ({ sdp, roomId }: { sdp: string; roomId: string }) => {
            this.roomManager.onOffer(roomId, sdp);
        }
    );

    socket.on(
        "answer",
        ({ sdp, roomId }: { sdp: string; roomId: string }) => {
            this.roomManager.onAnswer(roomId, sdp);
        }
    );
}
    generate()
    {
        return "1232"
    }
}