import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import auditService from '../utils/auditService.js';

// Helper to create JWT token
const createToken = (id, role) => {
  // Ensure role is included in the token payload
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Send response with token
const createSendToken = (user, statusCode, res) => {
  // IMPORTANT: Temporary workaround for admin role recognition
  // This ensures the admin user always gets the correct role in the token
  // In production, this should be handled by a proper role management system
  const role = user.email === 'admin@fintechbank.com' ? 'admin' : user.role;
  
  const token = createToken(user._id, role);

  // Create a plain user object to avoid modifying the mongoose document directly
  const userObj = user.toObject();
  
  // Remove password from output
  delete userObj.password;

  res.status(statusCode).json({
    status: 'success',
    token,
    user: {
      ...userObj,
      role: role // Use the possibly overridden role
    }
  });
};

// @desc    Login user
// @route   POST /api/v1/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide email and password'
      });
    }

    // Check if user exists && password is correct
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
      return next(createError(401, 'Incorrect email or password'));
    }

    // If everything is ok, send token to client
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Signup user
// @route   POST /api/v1/auth/signup
// @access  Public
export const signup = async (req, res, next) => {
  try {
    // For security, only create regular users from public signup
    // Admin creation would be a separate process
    const newUser = await User.create({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      role: 'customer' // Default role
    });

    // Try to log the signup event but continue even if it fails
    try {
      await auditService.logEvent({
        eventType: 'user_signup',
        actorType: 'customer',
        actorId: newUser._id,
        actionDetails: { email: newUser.email },
        metadata: { ip: req.ip }
      });
    } catch (auditError) {
      console.warn('Audit logging failed but continuing with signup:', auditError.message);
    }

    createSendToken(newUser, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/v1/auth/logout
// @access  Public
export const logout = (req, res) => {
  res.status(200).json({ status: 'success' });
};

// @desc    Refresh token
// @route   POST /api/v1/auth/refresh-token
// @access  Public
export const refreshToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a token'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'The user belonging to this token no longer exists'
      });
    }

    // Check if user changed password after the token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      return res.status(401).json({
        status: 'error',
        message: 'User recently changed password. Please log in again'
      });
    }

    // Create new token
    createSendToken(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Verify token
// @route   POST /api/v1/auth/verify-token
// @access  Public
export const verifyToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a token'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'The user belonging to this token no longer exists'
      });
    }

    // If everything is ok, send response
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
