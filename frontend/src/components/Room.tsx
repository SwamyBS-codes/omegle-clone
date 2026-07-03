import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
const URL="http://localhost:3000"
const Room = () => {
  const [searchParams] = useSearchParams();
  const name = searchParams.get("name");

  useEffect(() => {
    const socket = io(URL)

    socket.connect();

    socket.on("send-offer", ({ roomId }) => {
      alert("send offer please");

      socket.emit("offer", {
        sdp: "",
        roomId,
      });
    });
     
    socket.on("offer",({roomId})=>{
      alert("send answer please");
      socket.emit("answer",{
        roomId,
        sdp:""
      });
    });

    socket.on("answer",({roomId})=>{
      alert("connection successful");
     
    });
  }, [name]);

  return <div>hai {name}</div>;
};

export default Room;