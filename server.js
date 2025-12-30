const express = require('express');
const app = express();
const http = require('http').createServer(app);

const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

// Helps you confirm the deployed file is the latest one
const VERSION = "relay-typing-v1";

app.get('/', (req, res) => {
  res.send('Relay Server is Running via Express');
});

app.get('/version', (req, res) => {
  res.send(VERSION);
});

function generateRoomID() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

io.on('connection', (socket) => {
  // 1) Create Room
  socket.on('create_room', () => {
    let roomID = generateRoomID();
    while (io.sockets.adapter.rooms.has(roomID)) {
      roomID = generateRoomID();
    }
    socket.join(roomID);
    socket.emit('room_created', roomID);
    console.log(`Room created: ${roomID}`);
  });

  // 2) Join Room
  socket.on('join_room', (roomID) => {
    const room = io.sockets.adapter.rooms.get(roomID);
    if (room && room.size > 0) {
      socket.join(roomID);
      socket.emit('join_success');
      socket.to(roomID).emit('phone_connected');
      console.log(`Phone joined room: ${roomID}`);
    } else {
      socket.emit('error_msg', "Invalid Room Code");
    }
  });

  // 3) Space triggers (start/stop)
  socket.on('phone_touch', (roomID) => {
    socket.to(roomID).emit('pc_trigger', 'down');
  });

  socket.on('phone_release', (roomID) => {
    socket.to(roomID).emit('pc_trigger', 'up');
  });

  // 4) Phone sends time (+ optional penalty) -> PC receives as pc_type
  // data can be:
  //   "12.34"
  // or:
  //   { timeString: "12.34", penalty: "ok" | "plus2" | "dnf" }
  socket.on('phone_time', (roomID, data) => {
    const payload = (typeof data === "string")
      ? { timeString: data, penalty: "ok" }
      : data;

    socket.to(roomID).emit('pc_type', payload);
  });

  // 5) Latency probe relay
  socket.on('latency_probe', (roomID, probeID) => {
    socket.to(roomID).emit('latency_probe', probeID);
  });

  socket.on('latency_probe_reply', (roomID, probeID) => {
    socket.to(roomID).emit('latency_probe_reply', probeID);
  });
});

http.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
