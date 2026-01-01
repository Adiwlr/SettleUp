const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Client = require('../models/Client');
const User = require('../models/User');
const Notification = require('../models/Notification');
const validator = require('validator');

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'settleup-secret-key');
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// Add a new client
router.post('/', verifyToken, async (req, res, next) => {
  try {
    const { name, email, companyName } = req.body;
    
    // Validation
    if (!name || !email || !companyName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and company name are required' 
      });
    }
    
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }
    
    // Check if client already exists with this email for the current user
    const existingClient = await Client.findOne({ 
      email, 
      addedBy: req.userId 
    });
    
    if (existingClient) {
      return res.status(400).json({ 
        success: false, 
        message: 'Client with this email already exists' 
      });
    }
    
    // Check if email belongs to an existing user
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      // Create client record with pending status
      const client = new Client({
        name,
        email,
        companyName,
        addedBy: req.userId,
        status: 'pending'
      });
      
      await client.save();
      
      // Add client to user's clients array
      await User.findByIdAndUpdate(req.userId, {
        $push: { clients: client._id }
      });
      
      // Create notification for the client
      const notification = new Notification({
        user: existingUser._id,
        type: 'client_add_request',
        title: 'New Client Request',
        message: `${req.body.addedByName || 'A user'} wants to add you as a client`,
        data: {
          clientId: client._id,
          addedBy: req.userId,
          addedByName: req.body.addedByName || 'Unknown',
          companyName: req.body.companyName || 'Unknown Company'
        }
      });
      
      await notification.save();
      
      // Send real-time notification via Socket.io
      const io = req.app.get('io');
      io.to(`user_${existingUser._id}`).emit('notification', {
        type: 'client_add_request',
        title: notification.title,
        message: notification.message,
        data: notification.data
      });
      
      res.status(201).json({
        success: true,
        message: 'Client request sent successfully',
        client
      });
    } else {
      // Create client record (non-user client)
      const client = new Client({
        name,
        email,
        companyName,
        addedBy: req.userId,
        status: 'active' // Auto-activate for non-users
      });
      
      await client.save();
      
      // Add client to user's clients array
      await User.findByIdAndUpdate(req.userId, {
        $push: { clients: client._id }
      });
      
      res.status(201).json({
        success: true,
        message: 'Client added successfully',
        client
      });
    }
  } catch (error) {
    next(error);
  }
});

// Respond to client request
router.post('/:clientId/respond', verifyToken, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { accept } = req.body;
    
    const client = await Client.findById(clientId);
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    // Check if the current user is the intended client
    const currentUser = await User.findById(req.userId);
    
    if (currentUser.email !== client.email) {
      return res.status(403).json({ 
        success: false, 
        message: 'You are not authorized to respond to this request' 
      });
    }
    
    if (accept) {
      client.status = 'active';
      await client.save();
      
      // Create notification for the user who added this client
      const notification = new Notification({
        user: client.addedBy,
        type: 'client_add_response',
        title: 'Client Request Accepted',
        message: `${client.name} has accepted your client request`,
        data: {
          clientId: client._id,
          clientName: client.name
        }
      });
      
      await notification.save();
      
      // Send real-time notification
      const io = req.app.get('io');
      io.to(`user_${client.addedBy}`).emit('notification', {
        type: 'client_add_response',
        title: notification.title,
        message: notification.message
      });
      
      res.json({
        success: true,
        message: 'Client request accepted successfully',
        client
      });
    } else {
      client.status = 'rejected';
      await client.save();
      
      // Remove client from user's clients array
      await User.findByIdAndUpdate(client.addedBy, {
        $pull: { clients: client._id }
      });
      
      // Create notification for the user who added this client
      const notification = new Notification({
        user: client.addedBy,
        type: 'client_add_response',
        title: 'Client Request Rejected',
        message: `${client.name} has rejected your client request`,
        data: {
          clientId: client._id,
          clientName: client.name
        }
      });
      
      await notification.save();
      
      // Send real-time notification
      const io = req.app.get('io');
      io.to(`user_${client.addedBy}`).emit('notification', {
        type: 'client_add_response',
        title: notification.title,
        message: notification.message
      });
      
      res.json({
        success: true,
        message: 'Client request rejected',
        client
      });
    }
  } catch (error) {
    next(error);
  }
});

// Get all clients for current user
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { search, status } = req.query;
    
    let query = { addedBy: req.userId };
    
    if (status) {
      query.status = status;
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } }
      ];
    }
    
    const clients = await Client.find(query)
      .sort({ createdAt: -1 })
      .populate('addedBy', 'name email companyName');
    
    res.json({
      success: true,
      clients
    });
  } catch (error) {
    next(error);
  }
});

// Search clients by email
router.get('/search/email', verifyToken, async (req, res, next) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email query parameter is required' 
      });
    }
    
    const clients = await Client.find({
      addedBy: req.userId,
      email: { $regex: email, $options: 'i' }
    });
    
    // Also check for users that might not be clients yet
    const potentialUsers = await User.find({
      email: { $regex: email, $options: 'i' },
      _id: { $ne: req.userId }
    }).select('name email companyName');
    
    res.json({
      success: true,
      clients,
      potentialUsers
    });
  } catch (error) {
    next(error);
  }
});

// Update client
router.put('/:clientId', verifyToken, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    
    const client = await Client.findOne({
      _id: clientId,
      addedBy: req.userId
    });
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    Object.assign(client, req.body);
    await client.save();
    
    res.json({
      success: true,
      message: 'Client updated successfully',
      client
    });
  } catch (error) {
    next(error);
  }
});

// Delete client
router.delete('/:clientId', verifyToken, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    
    const client = await Client.findOneAndDelete({
      _id: clientId,
      addedBy: req.userId
    });
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    // Remove client from user's clients array
    await User.findByIdAndUpdate(req.userId, {
      $pull: { clients: clientId }
    });
    
    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Get client by ID
router.get('/:clientId', verifyToken, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    
    const client = await Client.findOne({
      _id: clientId,
      addedBy: req.userId
    }).populate('addedBy', 'name email companyName');
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    res.json({
      success: true,
      client
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;