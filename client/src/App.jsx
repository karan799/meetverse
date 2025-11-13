import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const App = () => {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  // const [socket] = useState(() => io('http://localhost:3001'));
    const [socket] = useState(() => io('https://meetverse-zk38.onrender.com/'));
  const [localStream, setLocalStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [isCaller, setIsCaller] = useState(false);
  const [recording, setRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const mediaRecorderRef = useRef();
  const recordedChunksRef = useRef([]);

  const getIceServers = async () => {
    const res = await fetch(
      "https://meetverse.metered.live/api/v1/turn/credentials?apiKey=4bae79092f7f6cddf27d77cd89eacec5a519"
    );
    const iceServers = await res.json();
    console.log("✅ ICE servers fetched:", iceServers);
    return iceServers;
  };

  const createPeerConnection = (servers) => {
    console.log("🔗 Creating RTCPeerConnection...");
    const pc = new RTCPeerConnection({ iceServers: servers });

    pc.ontrack = (event) => {
      console.log("📺 Received remote track");
      remoteVideoRef.current.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("🌐 Sending ICE candidate via Socket.IO:", event.candidate);
        socket.emit("candidate", event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("🔌 Peer connection state:", pc.connectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log("📝 Signaling State:", pc.signalingState);
    };

    return pc;
  };

  const startCall = async () => {
    console.log("📄 Caller clicked Start Call");
    setIsCaller(true);

    const servers = await getIceServers();
    const pc = createPeerConnection(servers);
    setPeerConnection(pc);

    pc.addTransceiver("video", { direction: "recvonly" });
    pc.addTransceiver("audio", { direction: "recvonly" });
    console.log("🎯 Added recvonly video/audio transceivers for caller");

    console.log("📄 Creating offer...");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    console.log("📝 Signaling State:", pc.signalingState);
    console.log("📤 Sending offer to server via Socket.IO");
    socket.emit("offer", offer);
  };

  const toggleRecording = () => {
    if (!remoteVideoRef.current.srcObject) {
      alert("❌ No remote video to record yet!");
      return;
    }

    if (!recording) {
      recordedChunksRef.current = [];
      mediaRecorderRef.current = new MediaRecorder(remoteVideoRef.current.srcObject, { 
        mimeType: "video/webm; codecs=vp8,opus" 
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
        console.log("✅ Recording stopped, ready to download");
      };

      mediaRecorderRef.current.start();
      setRecording(true);
      console.log("⏺ Recording started");
    } else {
      mediaRecorderRef.current.stop();
      setRecording(false);
      console.log("⏹ Recording stopped");
    }
  };

  useEffect(() => {
    socket.on("offer", async (offer) => {
      if (isCaller) return;

      console.log("📩 Received offer via Socket.IO");

      console.log("🎥 Accessing callee camera...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;
      setLocalStream(stream);
      console.log("✅ Callee camera accessed");

      const servers = await getIceServers();
      const pc = createPeerConnection(servers);
      setPeerConnection(pc);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));
      console.log("✅ Callee tracks added");

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log("✅ Remote description set for callee");

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log("📤 Sending answer to server via Socket.IO");
      socket.emit("answer", answer);
    });

    socket.on("answer", async (answer) => {
      if (!peerConnection) return;
      console.log("📩 Received answer via Socket.IO");
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("✅ Remote description set for caller");
    });

    socket.on("candidate", async (candidate) => {
      try {
        if (peerConnection) {
          console.log("🌐 Received ICE candidate via Socket.IO", candidate);
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("❌ Error adding ICE candidate", err);
      }
    });

    return () => {
      socket.off("offer");
      socket.off("answer");
      socket.off("candidate");
    };
  }, [socket, isCaller, peerConnection]);

  return (
    <div style={{ fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2>🟢 Localhost Video Call</h2>
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
        <video 
          ref={localVideoRef}
          autoPlay 
          muted 
          playsInline
          style={{ width: '45%', margin: '10px', border: '2px solid #444' }}
        />
        <video 
          ref={remoteVideoRef}
          autoPlay 
          playsInline
          style={{ width: '45%', margin: '10px', border: '2px solid #444' }}
        />
      </div>

      <button 
        onClick={startCall}
        style={{ marginTop: '10px', padding: '10px', fontSize: '16px' }}
      >
        Start Call
      </button>
      
      <button 
        onClick={toggleRecording}
        style={{ marginTop: '10px', padding: '10px', fontSize: '16px' }}
      >
        {recording ? 'Stop Recording' : 'Start Recording'}
      </button>
      
      {downloadUrl && (
        <a 
          href={downloadUrl}
          download="callee_video.webm"
          onClick={() => setDownloadUrl('')}
          style={{ marginTop: '5px', padding: '10px', fontSize: '16px' }}
        >
          Download Recorded Video
        </a>
      )}
    </div>
  );
};

export default App;