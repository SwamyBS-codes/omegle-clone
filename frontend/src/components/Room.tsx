import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { Video, VideoOff, Mic, MicOff, Send, LogOut, RefreshCw, Sparkles, Volume2, VolumeX, Copy, Check, Users } from "lucide-react";

// Use Vite env var `VITE_BACKEND_URL` when available, otherwise default to localhost
const URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";
console.log("BACKEND URL =", URL);

interface Message {
  sender: "me" | "stranger" | "system";
  text: string;
}

const Room = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const roomId = searchParams.get("roomId") || "";
  const name = searchParams.get("name") || "Guest";

  const [lobby, setLobby] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);

  // New state variables
  const [strangerName, setStrangerName] = useState("Waiting...");
  const [strangerTyping, setStrangerTyping] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number | string>("...");
  const [soundsMuted, setSoundsMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [roomFull, setRoomFull] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const socketRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Refs for tracking typing and state in callbacks
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<any>(null);
  const strangerNameRef = useRef("Stranger");
  const soundsMutedRef = useRef(false);

  // Sync sounds muted ref
  useEffect(() => {
    soundsMutedRef.current = soundsMuted;
  }, [soundsMuted]);

  // Audio synthesis chimes
  const playChimeSound = () => {
    if (soundsMutedRef.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.12); // G5

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);

      // Close context after playback to free up audio system resources
      setTimeout(() => {
        ctx.close();
      }, 500);
    } catch (err) {
      console.error("Audio chime error:", err);
    }
  };

  // Redirect if no Room ID
  useEffect(() => {
    if (!roomId) {
      navigate("/");
    }
  }, [roomId, navigate]);

  // 1. Get Camera/Microphone on Mount
  useEffect(() => {
    if (!roomId) return;

    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Unable to access camera/microphone", error);
        setMessages((prev) => [
          ...prev,
          { sender: "system", text: "Error: Unable to access camera or microphone. Please check permissions." }
        ]);
      }
    };

    getMedia();

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomId]);

  // 2. Set Up Socket connection and WebRTC event listeners
  useEffect(() => {
    if (!localStream || !roomId) return;

    const socket = io(URL);
    socketRef.current = socket;

    setMessages([
      { sender: "system", text: `Joined Room ${roomId}. Waiting for other participant...` }
    ]);

    // Join room event
    socket.emit("join-room", { roomId, name });

    const createNewPeerConnection = () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" }
        ]
      });

      // Add local tracks
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // Remote track handler
      pc.ontrack = (event) => {
        const stream = event.streams?.[0] ?? new MediaStream([event.track]);
        setRemoteStream(stream);
      };

      // ICE candidates
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          roomId,
        });
      };

      // Connection state handler
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setConnected(true);
          setLobby(false);
          setMessages((prev) => [
            ...prev,
            { sender: "system", text: `Connected with ${strangerNameRef.current}. Start talking!` }
          ]);
        } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          setConnected(false);
        }
      };

      pcRef.current = pc;
      return pc;
    };

    // Server emits online-count update
    socket.on("online-count", (count: number) => {
      setOnlineCount(count);
    });

    // Room is full error
    socket.on("room-full", () => {
      setRoomFull(true);
      setLobby(false);
      setConnected(false);
      setMessages([
        { sender: "system", text: "This room is full (maximum 2 participants). Please go back and create a new room." }
      ]);
    });

    // Match handler (User 2 - Joiner receives this)
    socket.on("matched", ({ strangerName: sName }) => {
      const displayStrangerName = sName || "Stranger";
      setStrangerName(displayStrangerName);
      strangerNameRef.current = displayStrangerName;
      setLobby(false);
      setStrangerTyping(false);
    });

    // Send offer request (User 1 - Creator receives this when User 2 joins)
    socket.on("send-offer", async ({ strangerName: sName }) => {
      const displayStrangerName = sName || "Stranger";
      setStrangerName(displayStrangerName);
      strangerNameRef.current = displayStrangerName;
      setLobby(false);
      setConnected(false);
      setRemoteStream(null);
      setStrangerTyping(false);

      try {
        const pc = createNewPeerConnection();
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", {
          sdp: offer.sdp,
          roomId,
        });
      } catch (err) {
        console.error("Error creating WebRTC offer", err);
      }
    });

    // Offer forwarded from peer (User 2 receives this)
    socket.on("offer", async ({ offer, strangerName: sName }) => {
      const displayStrangerName = sName || "Stranger";
      setStrangerName(displayStrangerName);
      strangerNameRef.current = displayStrangerName;
      setLobby(false);
      setConnected(false);
      setRemoteStream(null);
      setStrangerTyping(false);

      try {
        const pc = createNewPeerConnection();
        await pc.setRemoteDescription({ sdp: offer, type: "offer" });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", {
          sdp: answer.sdp,
          roomId,
        });
      } catch (err) {
        console.error("Error answering WebRTC offer", err);
      }
    });

    // Answer forwarded from peer (User 1 receives this)
    socket.on("answer", async ({ answer }) => {
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription({ sdp: answer, type: "answer" });
        } catch (err) {
          console.error("Error setting remote description", err);
        }
      }
    });

    // ICE Candidate forwarded from peer
    socket.on("ice-candidate", async ({ candidate }) => {
      if (pcRef.current && candidate) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding remote ICE candidate", error);
        }
      }
    });

    // Partner left
    socket.on("peer-left", () => {
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      setRemoteStream(null);
      setConnected(false);
      setLobby(true);
      setStrangerTyping(false);
      setMessages((prev) => [
        ...prev,
        { sender: "system", text: `${strangerNameRef.current} has left the call.` }
      ]);
      setStrangerName("Waiting...");
    });

    // Message received
    socket.on("message", ({ text, sender }: { text: string; sender: string }) => {
      setMessages((prev) => [
        ...prev,
        { sender: sender as "stranger" | "me" | "system", text }
      ]);
      if (sender === "stranger") {
        playChimeSound();
      }
    });

    // Typing status received from peer
    socket.on("typing", ({ typing }: { typing: boolean }) => {
      setStrangerTyping(typing);
    });

    return () => {
      socket.disconnect();
      if (pcRef.current) {
        pcRef.current.close();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [localStream, roomId]);

  // Auto Scroll Chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, strangerTyping]);

  // Connect Remote Stream to Video Node
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Handle Client-Side Typing Debouncing
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!connected || !socketRef.current || !roomId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socketRef.current.emit("typing", { typing: true, roomId });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        socketRef.current.emit("typing", { typing: false, roomId });
      }
    }, 1500);
  };

  // Send Message Logic
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !socketRef.current || !roomId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socketRef.current.emit("typing", { typing: false, roomId });
    }

    socketRef.current.emit("send-message", {
      message: inputText.trim(),
      roomId,
    });

    setMessages((prev) => [
      ...prev,
      { sender: "me", text: inputText.trim() }
    ]);
    setInputText("");
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = !micActive));
      setMicActive(!micActive);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = !cameraActive));
      setCameraActive(!cameraActive);
    }
  };

  const handleExit = () => {
    navigate("/");
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden select-none">
      {/* Top Header Navbar */}
      <header className="h-[65px] min-h-[65px] bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-600 p-2 rounded-xl">
            <Sparkles className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              AuraCall
            </h1>
            <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold font-mono">P2P Private Room</p>
          </div>
        </div>

        {/* Room ID & Link copying tools */}
        {!roomFull && (
          <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 max-w-[200px] md:max-w-xs overflow-hidden">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hidden md:inline">Room Code:</span>
            <span className="text-xs font-mono font-bold text-slate-300">{roomId}</span>
            <button
              onClick={handleCopyLink}
              className="p-1 rounded-md text-slate-500 hover:text-slate-200 hover:bg-slate-900 transition-all cursor-pointer ml-1"
              title="Copy Room Link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          {/* Sounds Toggle */}
          <button
            onClick={() => setSoundsMuted(!soundsMuted)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              soundsMuted
                ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
                : "bg-slate-950/50 border-slate-800 text-slate-400 hover:text-slate-200"
            }`}
            title={soundsMuted ? "Unmute Sound Alerts" : "Mute Sound Alerts"}
          >
            {soundsMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Active online count */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-full">
            <Users className="w-3 h-3 text-slate-500" />
            <span className="text-[9px] font-bold text-slate-450 uppercase tracking-wider">{onlineCount} Online</span>
          </div>

          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-red-500/10 hover:text-red-400 border border-slate-700/50 hover:border-red-500/30 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Exit Call
          </button>
        </div>
      </header>

      {/* Main Workspace splits */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Column: Video Feeds */}
        <section className="w-full md:w-[48%] lg:w-[42%] flex flex-col bg-slate-900/15 border-r border-slate-900 p-4 gap-4 overflow-y-auto shrink-0">
          
          {/* Remote Video Container */}
          <div className="flex-1 min-h-[240px] bg-slate-950 rounded-2xl overflow-hidden shadow-xl border border-slate-800/80 relative flex items-center justify-center">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
                {roomFull ? (
                  <div className="space-y-2 flex flex-col items-center text-red-400">
                    <span className="text-sm font-black uppercase tracking-wider">Room Full</span>
                    <p className="text-xs text-slate-500 max-w-[200px] leading-relaxed">This conference is restricted to 2 users.</p>
                  </div>
                ) : lobby ? (
                  <div className="space-y-4 flex flex-col items-center max-w-[240px]">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full border border-blue-500/20 border-t-blue-500 animate-spin" />
                      <Users className="w-5 h-5 text-blue-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Waiting for participant</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Share the Room Code <span className="font-mono font-bold text-slate-350 bg-slate-900 px-1.5 py-0.5 rounded">{roomId}</span> with a friend to join the call.
                      </p>
                      <button
                        onClick={handleCopyLink}
                        className="mx-auto text-[10px] bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all mt-1"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            Copied Link!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            Copy Invite Link
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 flex flex-col items-center text-slate-500">
                    <RefreshCw className="w-10 h-10 animate-spin text-slate-800" />
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-650">Connecting P2P stream...</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Overlay Tag */}
            <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 text-[9px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-lg shadow-md text-blue-450">
              {strangerName}
            </div>
          </div>

          {/* Local Video Container */}
          <div className="h-[150px] sm:h-[180px] md:h-[220px] bg-slate-950 rounded-2xl overflow-hidden shadow-xl border border-slate-800/80 relative flex items-center justify-center shrink-0">
            {localStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-slate-750 text-[10px] font-bold uppercase tracking-widest animate-pulse">Accessing Camera...</div>
            )}
            
            {/* Overlay Tag */}
            <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-800 text-[9px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-lg shadow-md text-indigo-400">
              {name} (You)
            </div>

            {/* Media toggles overlay */}
            <div className="absolute bottom-3 right-3 flex gap-2">
              <button
                onClick={toggleMic}
                disabled={roomFull}
                className={`p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer ${
                  micActive
                    ? "bg-slate-900/90 border-slate-800 hover:bg-slate-800 text-slate-350"
                    : "bg-red-500/20 border-red-500/30 text-red-400 font-bold"
                } disabled:opacity-30`}
                title={micActive ? "Mute Mic" : "Unmute Mic"}
              >
                {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
              <button
                onClick={toggleCamera}
                disabled={roomFull}
                className={`p-2 rounded-xl backdrop-blur-md border transition-all cursor-pointer ${
                  cameraActive
                    ? "bg-slate-900/90 border-slate-800 hover:bg-slate-800 text-slate-350"
                    : "bg-red-500/20 border-red-500/30 text-red-400 font-bold"
                } disabled:opacity-30`}
                title={cameraActive ? "Turn Off Camera" : "Turn On Camera"}
              >
                {cameraActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

        </section>

        {/* Right Column: Chat Section */}
        <section className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
          
          {/* Matching info bar */}
          <div className="h-11 border-b border-slate-900/80 bg-slate-950 px-4 flex items-center justify-between text-[11px] text-slate-500 shrink-0 z-10">
            {connected ? (
              <span className="flex items-center gap-1.5 text-slate-400 font-bold uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Active text session
              </span>
            ) : roomFull ? (
              <span className="font-bold text-red-450 uppercase">Conference Full</span>
            ) : (
              <span className="font-semibold italic">Waiting for text session to activate...</span>
            )}
          </div>

          {/* Message Feed */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin scrollbar-thumb-slate-850 z-10">
            {messages.map((msg, index) => {
              if (msg.sender === "system") {
                return (
                  <div key={index} className="flex justify-center my-3">
                    <span className="text-[10px] font-bold tracking-wider uppercase bg-indigo-550/10 text-indigo-350 border border-indigo-500/15 px-4.5 py-2 rounded-full select-none text-center max-w-[85%] shadow-md">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isMe = msg.sender === "me";
              return (
                <div
                  key={index}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[70%] rounded-2xl px-4.5 py-3 text-[13.5px] shadow-md flex flex-col gap-0.5 border ${
                    isMe
                      ? "bg-gradient-to-r from-blue-600 to-indigo-650 text-white border-blue-500/15 rounded-br-none"
                      : "bg-slate-900 text-slate-200 border-slate-850 rounded-bl-none"
                  }`}>
                    <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${isMe ? "text-blue-200/80" : "text-slate-450"}`}>
                      {isMe ? "You" : strangerName}
                    </p>
                    <p className="leading-relaxed break-words font-medium">{msg.text}</p>
                  </div>
                </div>
              );
            })}

            {/* Remote Typing Indicator Bubble */}
            {strangerTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-900 border border-slate-850 rounded-2xl rounded-bl-none px-4.5 py-3 shadow-md max-w-[70%] flex flex-col gap-1.5">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                    {strangerName} is typing
                  </p>
                  <div className="flex items-center gap-1.5 py-1 px-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce duration-300" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce duration-300" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce duration-300" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-900 bg-slate-950 flex items-center gap-3 shrink-0 z-10">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              disabled={!connected || roomFull}
              placeholder={roomFull ? "Room is full..." : connected ? "Type a message..." : "Waiting to match..."}
              className="flex-1 h-12 bg-slate-900 border border-slate-850 rounded-xl px-4.5 text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!connected || !inputText.trim() || roomFull}
              className="h-12 w-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-900 disabled:text-slate-750 text-white rounded-xl shadow-md flex items-center justify-center transition-all shrink-0 cursor-pointer disabled:cursor-not-allowed disabled:shadow-none"
            >
              <Send className="w-5.5 h-5.5" />
            </button>
          </form>

        </section>

      </div>
    </div>
  );
};

export default Room;
