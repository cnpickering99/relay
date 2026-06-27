const express = require('express');
const app = express();
const port = 3000;
const usersRoutes = require('./routes/usersRoutes');

app.use(express.json());

app.use('/users', usersRoutes);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});