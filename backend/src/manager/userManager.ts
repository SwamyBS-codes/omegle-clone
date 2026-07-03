import type { Socket } from "socket.io";
import { RoomManager } from "../roomManager.js";

export interface User
{
    name:string,
    socket:Socket
}
let count=0;
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
        socket.send("lobby");
        this.clearQueue();
        this.initHandler(socket)
    }
    removeUser(socketId:string)
    {
        const userExit=this.users.find(x=>x.socket.id==socketId)
        this.users=this.users.filter(x=> x.socket.id!==socketId)
        this.queue=this.queue.filter(x=>x!==socketId)
    }
    clearQueue()
    {
        console.log(this.users)
        console.log("inside clear queue");
        if(this.queue.length <2) 
        {
            return ;
        }
        const id1=this.queue.pop();
        const id2=this.queue.pop();
        const person1=this.users.find(x=>x.socket.id===id1)
        const person2=this.users.find(x=>x.socket.id===id2)
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
        return count++;
    }
}