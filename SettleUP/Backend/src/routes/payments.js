const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Client = require('../models/Client');
const Notification = require('../models/Notification');
const moment = require('moment-timezone');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

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

// Create payment schedule for client
router.post('/schedule', verifyToken, async (req, res, next) => {
  try {
    const { clientId, description, amount, dueDate, frequency, currency } = req.body;
    
    const client = await Client.findOne({
      _id: clientId,
      addedBy: req.userId
    });
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    if (client.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot schedule payments for inactive clients' 
      });
    }
    
    const paymentSchedule = {
      description,
      amount,
      currency: currency || client.region?.currency || 'USD',
      dueDate: new Date(dueDate),
      frequency: frequency || 'one-time',
      status: 'pending'
    };
    
    client.paymentSchedules.push(paymentSchedule);
    await client.save();
    
    // Schedule notification for payment due
    schedulePaymentNotification(client, paymentSchedule);
    
    res.status(201).json({
      success: true,
      message: 'Payment schedule created successfully',
      paymentSchedule
    });
  } catch (error) {
    next(error);
  }
});

// Get all payment schedules for a client
router.get('/client/:clientId', verifyToken, async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { status } = req.query;
    
    const client = await Client.findOne({
      _id: clientId,
      addedBy: req.userId
    });
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    let paymentSchedules = client.paymentSchedules;
    
    if (status) {
      paymentSchedules = paymentSchedules.filter(schedule => schedule.status === status);
    }
    
    // Sort by due date
    paymentSchedules.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    res.json({
      success: true,
      paymentSchedules
    });
  } catch (error) {
    next(error);
  }
});

// Update payment schedule
router.put('/schedule/:clientId/:scheduleIndex', verifyToken, async (req, res, next) => {
  try {
    const { clientId, scheduleIndex } = req.params;
    
    const client = await Client.findOne({
      _id: clientId,
      addedBy: req.userId
    });
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    if (scheduleIndex >= client.paymentSchedules.length) {
      return res.status(404).json({ success: false, message: 'Payment schedule not found' });
    }
    
    Object.assign(client.paymentSchedules[scheduleIndex], req.body);
    await client.save();
    
    res.json({
      success: true,
      message: 'Payment schedule updated successfully',
      paymentSchedule: client.paymentSchedules[scheduleIndex]
    });
  } catch (error) {
    next(error);
  }
});

// Mark payment as paid
router.post('/:clientId/:scheduleIndex/mark-paid', verifyToken, async (req, res, next) => {
  try {
    const { clientId, scheduleIndex } = req.params;
    
    const client = await Client.findOne({
      _id: clientId,
      addedBy: req.userId
    });
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    if (scheduleIndex >= client.paymentSchedules.length) {
      return res.status(404).json({ success: false, message: 'Payment schedule not found' });
    }
    
    const paymentSchedule = client.paymentSchedules[scheduleIndex];
    paymentSchedule.status = 'paid';
    paymentSchedule.paidAt = new Date();
    
    await client.save();
    
    // Create notification for client if they are a user
    const clientUser = await User.findOne({ email: client.email });
    if (clientUser) {
      const notification = new Notification({
        user: clientUser._id,
        type: 'payment_received',
        title: 'Payment Marked as Paid',
        message: `${client.addedBy.name} marked a payment as paid: ${paymentSchedule.description}`,
        data: {
          clientId: client._id,
          scheduleIndex,
          amount: paymentSchedule.amount,
          currency: paymentSchedule.currency
        }
      });
      
      await notification.save();
      
      // Send real-time notification
      const io = req.app.get('io');
      io.to(`user_${clientUser._id}`).emit('notification', {
        type: 'payment_received',
        title: notification.title,
        message: notification.message
      });
    }
    
    res.json({
      success: true,
      message: 'Payment marked as paid',
      paymentSchedule
    });
  } catch (error) {
    next(error);
  }
});

// Create Stripe payment link
router.post('/create-payment-link', verifyToken, async (req, res, next) => {
  try {
    const { clientId, scheduleIndex, successUrl, cancelUrl } = req.body;
    
    const client = await Client.findOne({
      _id: clientId,
      addedBy: req.userId
    }).populate('addedBy', 'stripeCustomerId');
    
    if (!client) {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    
    if (scheduleIndex >= client.paymentSchedules.length) {
      return res.status(404).json({ success: false, message: 'Payment schedule not found' });
    }
    
    const paymentSchedule = client.paymentSchedules[scheduleIndex];
    
    // Create Stripe payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{
        price_data: {
          currency: paymentSchedule.currency.toLowerCase(),
          product_data: {
            name: paymentSchedule.description || 'Payment',
            description: `Payment for ${client.companyName}`
          },
          unit_amount: Math.round(paymentSchedule.amount * 100), // Convert to cents
        },
        quantity: 1,
      }],
      after_completion: {
        type: 'redirect',
        redirect: {
          url: successUrl || `${process.env.FRONTEND_URL}/dashboard/payments/success`
        }
      },
      metadata: {
        clientId: client._id.toString(),
        scheduleIndex: scheduleIndex.toString(),
        userId: req.userId.toString()
      }
    });
    
    res.json({
      success: true,
      paymentLink: paymentLink.url,
      expiresAt: paymentLink.expires_at
    });
  } catch (error) {
    next(error);
  }
});

// Webhook for Stripe payments
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      // Update payment status in database
      const { clientId, scheduleIndex, userId } = session.metadata;
      
      if (clientId && scheduleIndex) {
        const client = await Client.findById(clientId);
        if (client && scheduleIndex < client.paymentSchedules.length) {
          client.paymentSchedules[scheduleIndex].status = 'paid';
          client.paymentSchedules[scheduleIndex].paidAt = new Date();
          await client.save();
          
          // Create notification for user
          const notification = new Notification({
            user: userId,
            type: 'payment_received',
            title: 'Payment Received',
            message: `Payment received from ${client.name} for ${client.paymentSchedules[scheduleIndex].description}`,
            data: {
              clientId: client._id,
              amount: client.paymentSchedules[scheduleIndex].amount,
              currency: client.paymentSchedules[scheduleIndex].currency
            }
          });
          
          await notification.save();
          
          // Send real-time notification
          const io = req.app.get('io');
          io.to(`user_${userId}`).emit('notification', {
            type: 'payment_received',
            title: notification.title,
            message: notification.message
          });
        }
      }
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  res.json({ received: true });
});

// Helper function to schedule payment notifications
function schedulePaymentNotification(client, paymentSchedule) {
  // This would be implemented with a job scheduler like Bull or Agenda
  // For now, we'll create an immediate notification
  const dueDate = moment(paymentSchedule.dueDate);
  const now = moment();
  
  if (dueDate.isSameOrAfter(now)) {
    // Create notification
    const notification = new Notification({
      user: client.addedBy,
      type: 'payment_due',
      title: 'Payment Due Reminder',
      message: `Payment due for ${client.name}: ${paymentSchedule.description}`,
      data: {
        clientId: client._id,
        scheduleId: paymentSchedule._id,
        dueDate: paymentSchedule.dueDate,
        amount: paymentSchedule.amount,
        currency: paymentSchedule.currency
      }
    });
    
    notification.save();
    
    // Schedule additional reminders
    const daysBefore = [7, 3, 1]; // Remind 7, 3, and 1 day before due date
    
    daysBefore.forEach(days => {
      const reminderDate = dueDate.clone().subtract(days, 'days');
      if (reminderDate.isAfter(now)) {
        // Schedule job for reminder
        // In production, use a proper job scheduler
      }
    });
  }
}

module.exports = router;