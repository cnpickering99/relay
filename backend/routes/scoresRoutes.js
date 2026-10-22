// routes/scoresRoutes.js
const express = require('express');
const scoresController = require('./../controller/scoresController');
const usersController = require('./../controller/usersController');

const router = express.Router();

// Protected routes (require Authorization: Bearer <token> + x-user-email header)
router.post('/submit', usersController.authenticate, scoresController.submitScore);
router.get('/personal-best', usersController.authenticate, scoresController.getPersonalBest);

// Public (includes `me` when valid auth headers are sent)
router.get('/leaderboard', scoresController.getLeaderboard);

module.exports = router;
