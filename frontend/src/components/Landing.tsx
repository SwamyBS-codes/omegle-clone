import { useState } from "react";
import { Link } from "react-router-dom";

const Landing = () => {
    const [name,setName]=useState("");
  return (
    <div className="flex flex-col items-center justify-center h-screen py-2 gap-1">
        <input className="outline-none border border-gray-400 py-2 w-80 px-2 rounded"  
        onChange={(e)=>setName(e.target.value)} type="text" placeholder="Enter ur name"/>
        <Link  to={`/room/?name=${name}`} onClick={()=>{}} className="bg-green-400 border rounded px-6 h-10 cursor-pointer hover:bg-green-600 transition-all">
            Join</Link>    
</div>
  )
}

export default Landing
