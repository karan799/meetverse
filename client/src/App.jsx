import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';

const App = () => {
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  // const [socket] = useState(() => io('http://localhost:3001'));
  const [socket] = useState(() => io('https://meetverse-zk38.onrender.com/'));
  const [localStream, setLocalStream] = useState(null);
  const [peerConnection, setPeerConnection] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [isCreator, setIsCreator] = useState(false);
  const [isInRoom, setIsInRoom] = useState(false);
  const [recording, setRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const mediaRecorderRef = useRef();
  const recordedChunksRef = useRef([]);
  const messagesEndRef = useRef();

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
      console.log("📺 Received remote track:", event.track.kind);
      console.log('🎥 Remote stream:', event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        console.log('✅ Remote video element updated');
      } else {
        console.error('❌ Remote video ref not available');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("🌐 Sending ICE candidate via Socket.IO:", event.candidate);
        socket.emit("candidate", event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("🔌 Peer connection state:", pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.log('❌ Connection failed, you may need to restart the call');
      } else if (pc.connectionState === 'connected') {
        console.log('✅ Peer connection established successfully!');
      }
    };

    pc.onsignalingstatechange = () => {
      console.log("📝 Signaling State:", pc.signalingState);
    };

    return pc;
  };

  const createRoom = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8);
    setRoomId(newRoomId);
    setIsCreator(true);
    setIsInRoom(true);
    console.log('🏠 Room created:', newRoomId);
  };

  const joinRoomFromUrl = (roomFromUrl) => {
    setRoomId(roomFromUrl);
    setIsCreator(false);
    setIsInRoom(true);
    console.log('👤 Joined room:', roomFromUrl);
    socket.emit('user-joined-room', roomFromUrl);
  };

  const startCall = async () => {
    console.log("📄 Starting call in room:", roomId, "IsCreator:", isCreator);
    
    if (peerConnection) {
      console.log('🔄 Closing existing peer connection');
      peerConnection.close();
      setPeerConnection(null);
    }
    
    try {
      const servers = await getIceServers();
      const pc = createPeerConnection(servers);
      setPeerConnection(pc);
      console.log('✅ Peer connection created successfully');

      if (isCreator) {
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });
        console.log("🎯 Added recvonly transceivers for creator");

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('📤 Sending offer to server');
        socket.emit("offer", offer);
      } else {
        console.log('👤 Participant waiting for offer...');
      }
    } catch (error) {
      console.error('❌ Error starting call:', error);
    }
  };

  const toggleRecording = () => {
    if (!isCreator) {
      alert("❌ Only the room creator can record!");
      return;
    }
    
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

  const stopVideoTracks = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.stop();
        localStream.removeTrack(track);
      });
    }
  };

  const stopAudioTracks = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.stop();
        localStream.removeTrack(track);
      });
    }
  };

  const addVideoTrack = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = videoStream.getVideoTracks()[0];
      
      if (localStream) {
        localStream.addTrack(videoTrack);
        if (peerConnection) {
          peerConnection.addTrack(videoTrack, localStream);
        }
      } else {
        setLocalStream(videoStream);
        localVideoRef.current.srcObject = videoStream;
      }
    } catch (error) {
      console.error('Error accessing video:', error);
    }
  };

  const addAudioTrack = async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioTrack = audioStream.getAudioTracks()[0];
      
      if (localStream) {
        localStream.addTrack(audioTrack);
        if (peerConnection) {
          peerConnection.addTrack(audioTrack, localStream);
        }
      } else {
        setLocalStream(audioStream);
        localVideoRef.current.srcObject = audioStream;
      }
    } catch (error) {
      console.error('Error accessing audio:', error);
    }
  };

  const toggleVideo = async () => {
    if (videoEnabled) {
      stopVideoTracks();
      setVideoEnabled(false);
    } else {
      await addVideoTrack();
      setVideoEnabled(true);
    }
  };

  const toggleAudio = async () => {
    if (audioEnabled) {
      stopAudioTracks();
      setAudioEnabled(false);
    } else {
      await addAudioTrack();
      setAudioEnabled(true);
    }
  };

  const sendMessage = () => {
    console.log('💬 Send message clicked, message:', newMessage);
    if (newMessage.trim()) {
      const message = {
        text: newMessage,
        sender: isCreator ? 'Creator' : 'Participant',
        timestamp: new Date().toLocaleTimeString()
      };
      // Use candidate event to send chat messages (server broadcasts these)
      const chatData = { type: 'chat', message };
      console.log('💬 Sending chat via candidate event:', chatData);
      socket.emit('candidate', chatData);
      console.log('💬 Message added to local state');
      setMessages(prev => [...prev, message]);
      setNewMessage('');
    } else {
      console.log('💬 Empty message, not sending');
    }
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    alert('Room link copied to clipboard!');
  };

  useEffect(() => {
    console.log('🔌 Socket connection status:', socket.connected);
    
    socket.on('connect', () => {
      console.log('✅ Socket connected successfully, socket ID:', socket.id);
    });
    
    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });
    
    socket.on('user-joined-room', (data) => {
      console.log('💬 Received user-joined-room event, data:', data, 'type:', typeof data);
      // Handle as regular join notification
      if (isCreator) {
        alert('👤 Someone joined your room!');
        console.log('👤 User joined the room');
      }
    });

    socket.on("offer", async (offer) => {
      console.log("📩 Received offer. IsCreator:", isCreator);
      if (isCreator) {
        console.log('⚠️ Ignoring offer because I am the creator');
        return;
      }

      if (peerConnection) {
        console.log('🔄 Closing existing peer connection for new offer');
        peerConnection.close();
      }

      console.log("🎥 Accessing participant media...");
      try {
        const constraints = {};
        if (videoEnabled) constraints.video = true;
        if (audioEnabled) constraints.audio = true;
        
        let stream;
        if (!constraints.video && !constraints.audio) {
          stream = new MediaStream();
        } else {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        }
        
        localVideoRef.current.srcObject = stream;
        setLocalStream(stream);
        console.log("✅ Participant media accessed");

        const servers = await getIceServers();
        const pc = createPeerConnection(servers);
        setPeerConnection(pc);

        stream.getTracks().forEach(track => {
          console.log('🎥 Adding track:', track.kind);
          pc.addTrack(track, stream);
        });
        console.log("✅ Participant tracks added");

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log("✅ Remote description set for participant");

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        console.log("📤 Sending answer to server via Socket.IO");
        socket.emit("answer", answer);
      } catch (error) {
        console.error('❌ Error in offer handling:', error);
      }
    });

    socket.on("answer", async (answer) => {
      console.log("📩 Received answer. PeerConnection exists:", !!peerConnection);
      if (!peerConnection) {
        console.log('⚠️ No peer connection available for answer');
        return;
      }
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log("✅ Remote description set for creator");
      } catch (error) {
        console.error('❌ Error setting remote description:', error);
      }
    });

    socket.on("candidate", async (candidate) => {
      console.log("🌐 Received candidate event, data:", candidate, "type:", typeof candidate);
      
      // Check if it's a chat message
      if (candidate && typeof candidate === 'object' && candidate.type === 'chat') {
        console.log('💬 Received chat message via candidate:', candidate.message);
        setMessages(prev => {
          const newMessages = [...prev, candidate.message];
          console.log('💬 Updated messages from candidate:', newMessages);
          return newMessages;
        });
        return;
      }
      
      // Handle as regular ICE candidate
      console.log("🌐 Processing as ICE candidate. PeerConnection exists:", !!peerConnection);
      try {
        if (peerConnection && peerConnection.remoteDescription && candidate.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('✅ ICE candidate added successfully');
        } else {
          console.log('⚠️ Skipping ICE candidate - no remote description or invalid candidate');
        }
      } catch (err) {
        console.error("❌ Error adding ICE candidate:", err);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('user-joined-room');
      socket.off("offer");
      socket.off("answer");
      socket.off("candidate");
    };
  }, [socket, isCreator, peerConnection, videoEnabled, audioEnabled]);

  useEffect(() => {
    console.log('💬 Messages updated, count:', messages.length, 'messages:', messages);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      joinRoomFromUrl(roomFromUrl);
    }
  }, []);

  if (!isInRoom) {
    return (
      <div style={{ fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
        <h2>🟢 Meetverse - Video Calling</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={createRoom}
            style={{ padding: '15px 30px', fontSize: '16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
          >
            Create Room
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <h2>🟮 Room: {roomId.substring(0, 8)}...</h2>
      
      {isCreator && (
        <div style={{ marginBottom: '10px' }}>
          <button 
            onClick={copyRoomLink}
            style={{ padding: '8px 16px', fontSize: '14px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' }}
          >
            Copy Room Link
          </button>
          <span style={{ fontSize: '12px', color: '#666' }}>Share this link to invite others</span>
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '5px', fontSize: '14px' }}>Your Video {isCreator ? '(Creator)' : '(Participant)'}</p>
          <video 
            ref={localVideoRef}
            autoPlay 
            muted 
            playsInline
            style={{ width: '300px', height: '200px', margin: '10px', border: '2px solid #444', backgroundColor: '#000' }}
          />
          <div style={{ margin: '10px' }}>
            <button 
              onClick={toggleVideo}
              style={{ padding: '8px 16px', fontSize: '14px', backgroundColor: videoEnabled ? '#4CAF50' : '#f44336', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', marginRight: '10px' }}
            >
              {videoEnabled ? '📹 Video On' : '📹 Video Off'}
            </button>
            <button 
              onClick={toggleAudio}
              style={{ padding: '8px 16px', fontSize: '14px', backgroundColor: audioEnabled ? '#4CAF50' : '#f44336', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
            >
              {audioEnabled ? '🎤 Mic On' : '🎤 Mic Off'}
            </button>
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: '5px', fontSize: '14px' }}>Remote Video</p>
          <video 
            ref={remoteVideoRef}
            autoPlay 
            playsInline
            style={{ width: '300px', height: '200px', margin: '10px', border: '2px solid #444', backgroundColor: '#000' }}
          />
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '10px' }}>
        <p style={{ fontSize: '12px', color: '#666', margin: '5px' }}>
          Status: {peerConnection ? `Connected (${peerConnection.connectionState})` : 'Not connected'}
        </p>
        <button 
          onClick={startCall}
          style={{ padding: '10px 20px', fontSize: '16px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          {isCreator ? 'Start Call (Send Offer)' : 'Ready to Receive Call'}
        </button>
      </div>
      
      {isCreator && (
        <button 
          onClick={toggleRecording}
          style={{ marginTop: '10px', padding: '10px', fontSize: '16px', backgroundColor: recording ? '#f44336' : '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          {recording ? 'Stop Recording' : 'Start Recording'}
        </button>
      )}
      
      {downloadUrl && isCreator && (
        <a 
          href={downloadUrl}
          download="room_video.webm"
          onClick={() => setDownloadUrl('')}
          style={{ marginTop: '5px', padding: '10px', fontSize: '16px', backgroundColor: '#2196F3', color: 'white', textDecoration: 'none', borderRadius: '5px' }}
        >
          Download Recorded Video
        </a>
      )}
      
      <div style={{ width: '100%', maxWidth: '600px', marginTop: '20px', border: '1px solid #ccc', borderRadius: '10px', backgroundColor: '#f9f9f9' }}>
        <div style={{ padding: '10px', borderBottom: '1px solid #ccc', backgroundColor: '#e9e9e9', borderRadius: '10px 10px 0 0' }}>
          <h3 style={{ margin: '0', fontSize: '16px' }}>💬 Chat</h3>
        </div>
        
        <div style={{ height: '200px', overflowY: 'auto', padding: '10px' }}>
          {messages.length === 0 ? (
            <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center' }}>No messages yet...</p>
          ) : (
            messages.map((msg, index) => (
              <div key={index} style={{ marginBottom: '8px', padding: '5px', backgroundColor: 'white', borderRadius: '5px', border: '1px solid #eee' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '2px' }}>
                  <strong>{msg.sender}</strong> - {msg.timestamp}
                </div>
                <div style={{ fontSize: '14px' }}>{msg.text}</div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div style={{ padding: '10px', borderTop: '1px solid #ccc', display: 'flex', gap: '10px' }}>
          <input 
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '5px', fontSize: '14px' }}
          />
          <button 
            onClick={sendMessage}
            style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;