import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, PlusCircle, LogIn } from "lucide-react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || "https://rejoicing-gizzard-font.ngrok-free.dev";

const Landing = () => {
  const [name, setName] = useState("");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [onlineCount, setOnlineCount] = useState<number | string>("...");
  const navigate = useNavigate();

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on("online-count", (count: number) => {
      setOnlineCount(count);
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  const handleCreateRoom = () => {
    const finalName = name.trim() || "Guest";
    // Generate a unique 6-character alphanumeric room code
    const generatedId = Math.random().toString(36).substring(2, 8).toUpperCase();
    navigate(`/room?roomId=${generatedId}&name=${encodeURIComponent(finalName)}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || "Guest";
    const finalRoomId = joinRoomId.trim().toUpperCase();
    if (!finalRoomId) return;
    navigate(`/room?roomId=${finalRoomId}&name=${encodeURIComponent(finalName)}`);
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between overflow-x-hidden font-sans select-none">
      {/* Glow Effects */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none animate-pulse duration-[8s]" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px] pointer-events-none animate-pulse duration-[12s]" />

      {/* Top Header */}
      <header className="w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 p-2 rounded-xl shadow-lg shadow-blue-500/10">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent tracking-tight">
              AuraCall
            </h1>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold font-mono">P2P Private Conferencing</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-400 text-sm">
          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-full relative">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="w-2 h-2 rounded-full bg-emerald-500 absolute" />
            <span className="font-semibold text-xs text-slate-350 ml-2">{onlineCount} Online</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 z-10">
        <div className="w-full max-w-lg bg-slate-900/30 border border-slate-800/80 backdrop-blur-2xl rounded-3xl p-8 md:p-10 shadow-2xl relative">
          <div className="absolute -top-3 -right-3 bg-gradient-to-r from-blue-500 to-indigo-650 text-white text-[9px] font-extrabold px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-md">
            WebRTC Direct
          </div>

          <div className="text-center mb-8">
            <h2 className="text-3xl font-black tracking-tight text-white mb-2 leading-tight">
              Direct P2P Video Call
            </h2>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              Create a secure private room and share the link with a friend to start a high-quality video call instantly.
            </p>
          </div>

          <div className="space-y-6">
            {/* Nickname Input */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Your Nickname
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter a username (e.g. Astro)"
                maxLength={16}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-5 py-3.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all text-sm font-semibold"
              />
            </div>

            {/* Split Options: Create or Join */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              
              {/* Option A: Create a Room */}
              <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-200 flex items-center gap-1.5">
                    <PlusCircle className="w-4 h-4 text-blue-400" />
                    New Call
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Generate a new private room code and invite someone to join.
                  </p>
                </div>
                <button
                  onClick={handleCreateRoom}
                  className="w-full bg-blue-600 hover:bg-blue-750 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider"
                >
                  Create Room
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Option B: Join a Room */}
              <form onSubmit={handleJoinRoom} className="bg-slate-950/40 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between space-y-3.5">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-200 flex items-center gap-1.5">
                    <LogIn className="w-4 h-4 text-indigo-400" />
                    Join Call
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed mb-3">
                    Enter an existing 6-character room code to connect.
                  </p>
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="Enter Code (e.g. H8X1J2)"
                    maxLength={10}
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-center text-slate-200 placeholder-slate-650 focus:outline-none focus:border-indigo-500 transition-all text-xs font-bold uppercase tracking-widest"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!joinRoomId.trim()}
                  className="w-full bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-900 disabled:text-slate-600 disabled:border-slate-850 border border-indigo-500/20 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer text-xs uppercase tracking-wider disabled:cursor-not-allowed"
                >
                  Join Room
                </button>
              </form>

            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950/60 backdrop-blur-md px-6 py-5 text-center text-[10px] text-slate-650 z-10">
        <div className="flex justify-center gap-6 mb-2 text-[11px] font-semibold text-slate-500">
          <a href="#" className="hover:text-slate-350 transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-slate-350 transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-slate-350 transition-colors">Guidelines</a>
        </div>
        <p>© 2026 AuraCall. End-to-end media transmission is handled directly between browsers.</p>
      </footer>
    </div>
  );
};

export default Landing;
