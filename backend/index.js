const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 3000;

const usersRoutes = require('./routes/usersRoutes');
const scoresRoutes = require('./routes/scoresRoutes');
const createWebSocketServer = require('./multiplayer/websocketServer');

app.use(cors());
app.use(express.json());

app.use('/users', usersRoutes);
app.use('/scores', scoresRoutes);

app.get('/', (req, res) => {
  res.send('Relay API is running!');
});

createWebSocketServer(server);

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});