import React, { useState, useRef, useEffect } from 'react';
import io from 'socket.io-client';
import { 
  Layout, 
  Card, 
  Button, 
  Typography, 
  Space, 
  Row, 
  Col, 
  Input, 
  Badge, 
  Avatar, 
  Divider,
  Tooltip,
  notification,
  Drawer,
  FloatButton
} from 'antd';
import {
  VideoCameraOutlined,
  VideoCameraAddOutlined,
  AudioOutlined,
  AudioMutedOutlined,
  PhoneOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CopyOutlined,
  SendOutlined,
  MessageOutlined,
  UserOutlined,
  DownloadOutlined,
  MenuOutlined,
  CloseOutlined
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

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
  const [chatVisible, setChatVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const mediaRecorderRef = useRef();
  const recordedChunksRef = useRef([]);
  const messagesEndRef = useRef();

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getIceServers = async () => {
    const res = await fetch(
      "https://meetverse.metered.live/api/v1/turn/credentials?apiKey=4bae79092f7f6cddf27d77cd89eacec5a519"
    );
    const iceServers = await res.json();
    return iceServers;
  };

  const createPeerConnection = (servers) => {
    const pc = new RTCPeerConnection({ iceServers: servers });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("candidate", { candidate: event.candidate, roomId });
      }
    };

    return pc;
  };

  const createRoom = () => {
    if (!socket.connected) {
      socket.connect();
      setTimeout(() => {
        if (socket.connected) {
          socket.emit('create-room');
        } else {
          notification.error({
            message: 'Connection Error',
            description: 'Cannot connect to server.',
            placement: 'topRight'
          });
        }
      }, 1000);
    } else {
      socket.emit('create-room');
    }
  };

  const joinRoomFromUrl = (roomFromUrl) => {
    socket.emit('join-room', roomFromUrl);
  };

  const startCall = async () => {
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    
    try {
      const servers = await getIceServers();
      const pc = createPeerConnection(servers);
      setPeerConnection(pc);

      if (isCreator) {
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.addTransceiver("audio", { direction: "recvonly" });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("offer", { offer, roomId });
      }
    } catch (error) {
      notification.error({
        message: 'Call Error',
        description: 'Failed to start the call.',
        placement: 'topRight'
      });
    }
  };

  const toggleRecording = () => {
    if (!isCreator) {
      notification.warning({
        message: 'Permission Denied',
        description: 'Only the host can record.',
        placement: 'topRight'
      });
      return;
    }
    
    if (!remoteVideoRef.current.srcObject) {
      notification.warning({
        message: 'No Video',
        description: 'No remote video to record yet!',
        placement: 'topRight'
      });
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
        notification.success({
          message: 'Recording Ready',
          description: 'Your recording is ready for download.',
          placement: 'topRight'
        });
      };

      mediaRecorderRef.current.start();
      setRecording(true);
    } else {
      mediaRecorderRef.current.stop();
      setRecording(false);
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
      notification.error({
        message: 'Camera Error',
        description: 'Failed to access camera.',
        placement: 'topRight'
      });
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
      notification.error({
        message: 'Microphone Error',
        description: 'Failed to access microphone.',
        placement: 'topRight'
      });
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
    if (newMessage.trim()) {
      const message = {
        text: newMessage,
        sender: isCreator ? 'Host' : 'Guest',
        timestamp: new Date().toLocaleTimeString()
      };
      socket.emit('chat-message', { message, roomId });
      setMessages(prev => [...prev, message]);
      setNewMessage('');
    }
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}?room=${roomId}`;
    navigator.clipboard.writeText(link);
    notification.success({
      message: 'Link Copied',
      description: 'Room link copied to clipboard.',
      placement: 'topRight'
    });
  };

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }
    
    socket.on('connect', () => {});
    socket.on('disconnect', (reason) => {});
    socket.on('connect_error', (error) => {});
    socket.on('reconnect', (attemptNumber) => {});
    socket.on('reconnect_error', (error) => {});
    
    socket.on('room-created', (roomId) => {
      setRoomId(roomId);
      setIsCreator(true);
      setIsInRoom(true);
      notification.success({
        message: 'Room Created',
        description: `Room ${roomId.substring(0, 8)} created successfully.`,
        placement: 'topRight'
      });
    });

    socket.on('room-joined', ({ roomId: joinedRoomId, isCreator: creator }) => {
      setRoomId(joinedRoomId);
      setIsCreator(creator);
      setIsInRoom(true);
      notification.success({
        message: 'Room Joined',
        description: `Joined room ${joinedRoomId.substring(0, 8)}.`,
        placement: 'topRight'
      });
    });

    socket.on('room-error', (error) => {
      notification.error({
        message: 'Room Error',
        description: error,
        placement: 'topRight'
      });
    });

    socket.on('user-joined', () => {
      if (isCreator) {
        notification.info({
          message: 'User Joined',
          description: 'Someone joined your room!',
          placement: 'topRight'
        });
      }
    });

    socket.on('chat-message', ({ message }) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on("offer", async (offer) => {
      if (isCreator) {
        return;
      }

      if (peerConnection) {
        peerConnection.close();
      }

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

        const servers = await getIceServers();
        const pc = createPeerConnection(servers);
        setPeerConnection(pc);

        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("answer", { answer, roomId });
      } catch (error) {
        console.error('Error in offer handling:', error);
      }
    });

    socket.on("answer", async (answer) => {
      if (!peerConnection) {
        return;
      }
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error setting remote description:', error);
      }
    });

    socket.on("candidate", async (candidate) => {
      try {
        if (peerConnection && peerConnection.remoteDescription && candidate.candidate) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('reconnect');
      socket.off('reconnect_error');
      socket.off('room-created');
      socket.off('room-joined');
      socket.off('room-error');
      socket.off('user-joined');
      socket.off('chat-message');
      socket.off("offer");
      socket.off("answer");
      socket.off("candidate");
    };
  }, [socket, isCreator, peerConnection, videoEnabled, audioEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      joinRoomFromUrl(roomFromUrl);
    }
  }, []);

  const ChatPanel = () => (
    <div style={{ padding: '16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Title level={5} style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MessageOutlined />
        Chat
        {isMobile && (
          <Button 
            type="text" 
            icon={<CloseOutlined />} 
            onClick={() => setChatVisible(false)}
            style={{ marginLeft: 'auto' }}
          />
        )}
      </Title>
      
      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px', maxHeight: isMobile ? '300px' : 'none' }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#999', marginTop: '40px' }}>
            <MessageOutlined style={{ fontSize: '32px', marginBottom: '8px' }} />
            <div>No messages yet</div>
            <Text type="secondary" style={{ fontSize: '12px' }}>Start the conversation!</Text>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message-bubble ${msg.sender === (isCreator ? 'Host' : 'Guest') ? 'own' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Avatar size="small" icon={<UserOutlined />} />
                <Text strong style={{ fontSize: '12px' }}>{msg.sender}</Text>
                <Text type="secondary" style={{ fontSize: '10px' }}>{msg.timestamp}</Text>
              </div>
              <Text>{msg.text}</Text>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <Space.Compact style={{ width: '100%' }}>
        <Input 
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onPressEnter={sendMessage}
          placeholder="Type a message..."
          style={{ borderRadius: '8px 0 0 8px' }}
        />
        <Button 
          type="primary" 
          onClick={sendMessage}
          icon={<SendOutlined />}
          style={{ borderRadius: '0 8px 8px 0' }}
        />
      </Space.Compact>
    </div>
  );

  if (!isInRoom) {
    return (
      <div className="meeting-layout" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh', 
        padding: isMobile ? '16px' : '20px' 
      }}>
        <Card className="welcome-card fade-in" style={{ maxWidth: isMobile ? '100%' : '400px' }}>
          <div className="logo-text" style={{ fontSize: isMobile ? '28px' : '32px' }}>Meetverse</div>
          <Text type="secondary" style={{ fontSize: isMobile ? '14px' : '16px', display: 'block', marginBottom: '32px' }}>
            Professional Video Conferencing
          </Text>
          
          <Button 
            type="primary" 
            size="large" 
            icon={<VideoCameraAddOutlined />}
            onClick={createRoom}
            className="pulse"
            style={{ 
              width: '100%', 
              height: isMobile ? '48px' : '50px', 
              fontSize: isMobile ? '14px' : '16px' 
            }}
          >
            Create Meeting Room
          </Button>
          
          <Divider />
          
          <Text type="secondary" style={{ fontSize: isMobile ? '12px' : '14px' }}>
            Create a room and share the link with others to start your professional meeting
          </Text>
        </Card>
      </div>
    );
  }

  return (
    <Layout className="meeting-layout" style={{ minHeight: '100vh' }}>
      <Header style={{ 
        padding: isMobile ? '0 16px' : '0 24px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        height: isMobile ? '56px' : '64px'
      }}>
        <Space align="center">
          <Title level={isMobile ? 5 : 4} style={{ color: 'white', margin: 0 }}>
            Meetverse
          </Title>
          <Badge 
            status={peerConnection ? "success" : "error"} 
            text={
              <Text style={{ color: 'white', fontSize: isMobile ? '12px' : '14px' }}>
                Room: {roomId.substring(0, isMobile ? 6 : 8)}...
              </Text>
            } 
          />
        </Space>
        
        <Space size={isMobile ? 'small' : 'middle'}>
          <Badge 
            count={isCreator ? 'Host' : 'Guest'} 
            style={{ 
              backgroundColor: isCreator ? '#722ed1' : '#1890ff',
              fontSize: isMobile ? '10px' : '12px'
            }}
          />
          {isCreator && (
            <Tooltip title="Copy room link">
              <Button 
                type="ghost" 
                icon={<CopyOutlined />} 
                onClick={copyRoomLink}
                size={isMobile ? 'small' : 'middle'}
                style={{ color: 'white', borderColor: 'white' }}
              >
                {!isMobile && 'Share'}
              </Button>
            </Tooltip>
          )}
          {isMobile && (
            <Button 
              type="ghost" 
              icon={<MessageOutlined />} 
              onClick={() => setChatVisible(true)}
              style={{ color: 'white', borderColor: 'white' }}
            />
          )}
        </Space>
      </Header>

      <Layout>
        <Content style={{ padding: isMobile ? '12px' : '24px' }}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={24} md={12} lg={isMobile ? 24 : 16}>
              <div style={{ marginBottom: '16px' }}>
                <Card className="video-card" bodyStyle={{ padding: 0 }}>
                  <div style={{ position: 'relative', aspectRatio: '16/9' }}>
                    <video 
                      ref={remoteVideoRef}
                      autoPlay 
                      playsInline
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <div style={{ 
                      position: 'absolute', 
                      bottom: '12px', 
                      left: '12px', 
                      background: 'rgba(0,0,0,0.7)', 
                      color: 'white', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      {isCreator ? 'Participant' : 'Host'}
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="video-card" bodyStyle={{ padding: 0 }}>
                <div style={{ position: 'relative', aspectRatio: isMobile ? '4/3' : '16/9' }}>
                  <video 
                    ref={localVideoRef}
                    autoPlay 
                    muted 
                    playsInline
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '12px', 
                    left: '12px', 
                    background: 'rgba(0,0,0,0.7)', 
                    color: 'white', 
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    You ({isCreator ? 'Host' : 'Guest'})
                  </div>
                </div>
              </Card>
            </Col>

            {!isMobile && (
              <Col xs={0} sm={0} md={12} lg={8}>
                <Card className="chat-panel" style={{ height: '600px' }}>
                  <ChatPanel />
                </Card>
              </Col>
            )}
          </Row>

          <Card className="control-panel" style={{ marginTop: '16px', textAlign: 'center' }}>
            <Space size={isMobile ? 'middle' : 'large'} wrap>
              <Tooltip title={videoEnabled ? "Turn off camera" : "Turn on camera"}>
                <Button 
                  className={`control-btn ${videoEnabled ? 'active' : 'inactive'}`}
                  onClick={toggleVideo}
                  icon={videoEnabled ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
                  size={isMobile ? 'middle' : 'large'}
                />
              </Tooltip>

              <Tooltip title={audioEnabled ? "Mute microphone" : "Unmute microphone"}>
                <Button 
                  className={`control-btn ${audioEnabled ? 'active' : 'inactive'}`}
                  onClick={toggleAudio}
                  icon={audioEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                  size={isMobile ? 'middle' : 'large'}
                />
              </Tooltip>

              <Tooltip title="Start/Join call">
                <Button 
                  className="control-btn neutral"
                  onClick={startCall}
                  icon={<PhoneOutlined />}
                  size={isMobile ? 'middle' : 'large'}
                />
              </Tooltip>

              {isCreator && (
                <Tooltip title={recording ? "Stop recording" : "Start recording"}>
                  <Button 
                    className={`control-btn ${recording ? 'inactive' : 'neutral'}`}
                    onClick={toggleRecording}
                    icon={recording ? <StopOutlined /> : <PlayCircleOutlined />}
                    size={isMobile ? 'middle' : 'large'}
                  />
                </Tooltip>
              )}

              {downloadUrl && isCreator && (
                <Tooltip title="Download recording">
                  <Button 
                    className="control-btn active"
                    href={downloadUrl}
                    download="meeting_recording.webm"
                    onClick={() => setDownloadUrl('')}
                    icon={<DownloadOutlined />}
                    size={isMobile ? 'middle' : 'large'}
                  />
                </Tooltip>
              )}
            </Space>

            <Divider />

            <Space>
              <Badge 
                status={peerConnection ? "success" : "error"} 
                text={peerConnection ? "Connected" : "Disconnected"} 
              />
            </Space>
          </Card>
        </Content>
      </Layout>

      {/* Mobile Chat Drawer */}
      <Drawer
        title="Chat"
        placement="bottom"
        onClose={() => setChatVisible(false)}
        open={chatVisible}
        height="70%"
        bodyStyle={{ padding: 0 }}
      >
        <ChatPanel />
      </Drawer>

      {/* Floating Chat Button for Mobile */}
      {isMobile && messages.length > 0 && !chatVisible && (
        <FloatButton
          icon={<MessageOutlined />}
          badge={{ count: messages.length, overflowCount: 99 }}
          onClick={() => setChatVisible(true)}
          style={{ right: 24, bottom: 24 }}
        />
      )}
    </Layout>
  );
};

export default App;