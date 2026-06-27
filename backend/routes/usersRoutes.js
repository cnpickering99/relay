// usersRoutes.js
//
// Express router for user auth endpoints. Mount in your app with:
//   const usersRoutes = require('./usersRoutes');
//   app.use('/users', usersRoutes);

const express = require('express');
const usersController = require('./../controller/usersController');

const router = express.Router();

// Public routes
router.post('/register', usersController.register);
router.post('/resend-code', usersController.resendVerificationCode);
router.post('/verify', usersController.verifyEmail);

// Protected routes (require Authorization: Bearer <token> + x-user-email header)
router.post('/logout', usersController.authenticate, usersController.logout);
router.get('/profile', usersController.authenticate, usersController.getProfile);
router.patch('/profile', usersController.authenticate, usersController.updateProfile);

module.exports = router;