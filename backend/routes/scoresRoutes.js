// routes/scoresRoutes.js
const express = require('express');
const scoresController = require('./../controller/scoresController');

const router = express.Router();

router.post('/submit', scoresController.submitScore);
router.get('/leaderboard', scoresController.getLeaderboard);
router.get('/personal-best', scoresController.getPersonalBest);

module.exports = router;