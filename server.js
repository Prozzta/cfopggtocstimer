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
    for (let i = 0; i < 4; i++) { 
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

io.on('connection', (socket) => {
    // 1. Create Room
    socket.on('create_room', () => {
        let roomID = generateRoomID();
        while (io.sockets.adapter.rooms.has(roomID)) {
            roomID = generateRoomID();
        }
        socket.join(roomID);
        socket.emit('room_created', roomID);
        console.log(`Room created: ${roomID}`);
    });

    // 2. Join Room
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

    // 3. Triggers (Stackmat Mode)
    socket.on('phone_touch', (roomID) => {
        socket.to(roomID).emit('pc_trigger', 'down');
    });
    socket.on('phone_release', (roomID) => {
        socket.to(roomID).emit('pc_trigger', 'up');
    });

    // 4. Typing Mode (Relay Time & Penalty)
    socket.on('phone_time', (roomID, data) => {
        // data = { val: 1234, pen: "plus2" }
        socket.to(roomID).emit('pc_type', data);
    });

    // 5. Commands (Delete, etc)
    socket.on('pc_command', (roomID, command) => {
        socket.to(roomID).emit('pc_command', command);
    });
});

http.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
