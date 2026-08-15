const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

const usersRoutes = require('./routes/usersRoutes');
const scoresRoutes = require('./routes/scoresRoutes');

app.use(cors());
app.use(express.json());

app.use('/users', usersRoutes);
app.use('/scores', scoresRoutes);

app.get('/', (req, res) => {
  res.send('Relay API is running!');
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});