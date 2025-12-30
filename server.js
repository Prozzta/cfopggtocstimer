const express = require('express');
const app = express();
const http = require('http').createServer(app);

const io = require('socket.io')(http, {
  cors: { origin: "*" }
});

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Relay Server is Running via Express');
});

function generateRoomID() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

// ✅ Works with Socket.IO v2/v3/v4 adapters
function getRoom(roomID) {
  const rooms = io.sockets.adapter.rooms;
  if (!rooms) return null;

  // v4: Map
  if (rooms instanceof Map) return rooms.get(roomID) || null;

  // v2/v3: plain object
  return rooms[roomID] || null;
}

function roomHasClients(roomID) {
  const room = getRoom(roomID);
  if (!room) return false;

  // v4: Set
  if (room instanceof Set) return room.size > 0;

  // v2/v3: object of socket ids
  if (typeof room === 'object') return Object.keys(room).length > 0;

  return false;
}

io.on('connection', (socket) => {
  // 1. Create Room
  socket.on('create_room', () => {
    let roomID = generateRoomID();
    while (roomHasClients(roomID)) {
      roomID = generateRoomID();
    }

    socket.join(roomID);
    socket.emit('room_created', roomID);
    console.log(`Room created: ${roomID}`);
  });

  // 2. Join Room
  socket.on('join_room', (roomID) => {
    if (roomHasClients(roomID)) {
      socket.join(roomID);
      socket.emit('join_success');
      socket.to(roomID).emit('phone_connected');
      console.log(`Phone joined room: ${roomID}`);
    } else {
      socket.emit('error_msg', "Invalid Room Code");
    }
  });

  // 3. Triggers (Space down/up)
  socket.on('phone_touch', (roomID) => {
    socket.to(roomID).emit('pc_trigger', 'down');
  });

  socket.on('phone_release', (roomID) => {
    socket.to(roomID).emit('pc_trigger', 'up');
  });

  // 4. Finished time (+ optional penalty) -> PC types it into csTimer
  socket.on('phone_time', (roomID, data) => {
    const payload = (typeof data === "string")
      ? { timeString: data, penalty: "ok" }
      : data;

    socket.to(roomID).emit('pc_type', payload);
  });

  // 5. Latency probe relay (phone -> pc -> phone)
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
