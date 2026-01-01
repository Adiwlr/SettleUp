// mongo-init.js
// This file runs automatically when MongoDB container starts for the first time
// It creates users, databases, and indexes

// Connect to admin database first
db = db.getSiblingDB('admin');

// Create admin user with root privileges
db.createUser({
  user: "admin",
  pwd: "password123",
  roles: [
    { role: "root", db: "admin" },
    { role: "readWriteAnyDatabase", db: "admin" }
  ]
});

// Create the main application database
db = db.getSiblingDB('settleup');

// Create application-specific user
db.createUser({
  user: "settleup_user",
  pwd: "settleup_password",
  roles: [
    { role: "readWrite", db: "settleup" },
    { role: "dbAdmin", db: "settleup" }
  ]
});

// ==================== CREATE COLLECTIONS ====================

// Users collection
db.createCollection("users");
// Clients collection  
db.createCollection("clients");
// Notifications collection
db.createCollection("notifications");
// Payments collection
db.createCollection("payments");
// Sessions collection (for express-session)
db.createCollection("sessions");

// ==================== CREATE INDEXES ====================

// Users collection indexes
db.users.createIndex({ email: 1 }, { 
  unique: true,
  name: "email_unique_index",
  background: true 
});

db.users.createIndex({ googleId: 1 }, { 
  sparse: true,
  name: "google_id_index",
  background: true 
});

db.users.createIndex({ createdAt: -1 }, {
  name: "created_at_index",
  background: true
});

// Clients collection indexes
db.clients.createIndex({ email: 1, addedBy: 1 }, {
  unique: true,
  name: "client_email_user_unique",
  background: true
});

db.clients.createIndex({ addedBy: 1 }, {
  name: "added_by_index",
  background: true
});

db.clients.createIndex({ status: 1 }, {
  name: "status_index",
  background: true
});

db.clients.createIndex({ 
  name: "text", 
  companyName: "text", 
  email: "text" 
}, {
  name: "client_search_index",
  weights: {
    name: 10,
    companyName: 5,
    email: 3
  },
  default_language: "english"
});

// Notifications collection indexes
db.notifications.createIndex({ user: 1, isRead: 1, createdAt: -1 }, {
  name: "user_notifications_index",
  background: true
});

db.notifications.createIndex({ createdAt: 1 }, { 
  expireAfterSeconds: 2592000, // 30 days TTL
  name: "notification_ttl_index"
});

db.notifications.createIndex({ type: 1 }, {
  name: "notification_type_index",
  background: true
});

// Payments collection indexes
db.payments.createIndex({ clientId: 1, dueDate: 1 }, {
  name: "client_payments_index",
  background: true
});

db.payments.createIndex({ dueDate: 1 }, {
  name: "due_date_index",
  background: true
});

db.payments.createIndex({ status: 1 }, {
  name: "payment_status_index",
  background: true
});

db.payments.createIndex({ 
  clientId: 1, 
  status: 1, 
  dueDate: 1 
}, {
  name: "payment_query_index",
  background: true
});

// Sessions collection indexes
db.sessions.createIndex({ expires: 1 }, {
  expireAfterSeconds: 0,
  name: "sessions_ttl_index"
});

// ==================== INSERT INITIAL DATA ====================

// Create admin user if not exists
const adminExists = db.users.findOne({ email: "admin@settleup.com" });
if (!adminExists) {
  const bcrypt = require('bcryptjs');
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync("Admin@123", salt);
  
  db.users.insertOne({
    email: "admin@settleup.com",
    password: hashedPassword,
    name: "System Administrator",
    companyName: "SettleUp Inc.",
    role: "admin",
    region: {
      timezone: "UTC",
      currency: "USD",
      country: "Global"
    },
    isActive: true,
    createdAt: new Date(),
    lastLogin: null
  });
  
  print("✅ Admin user created: admin@settleup.com / Admin@123");
}

// Create test user for demonstration (optional)
const testUserExists = db.users.findOne({ email: "demo@settleup.com" });
if (!testUserExists) {
  const bcrypt = require('bcryptjs');
  const salt = bcrypt.genSaltSync(10);
  const hashedPassword = bcrypt.hashSync("Demo@123", salt);
  
  db.users.insertOne({
    email: "demo@settleup.com",
    password: hashedPassword,
    name: "Demo User",
    companyName: "Demo Corp",
    role: "user",
    region: {
      timezone: "Asia/Kolkata",
      currency: "INR",
      country: "India"
    },
    isActive: true,
    createdAt: new Date(),
    lastLogin: null
  });
  
  print("✅ Demo user created: demo@settleup.com / Demo@123");
}

// ==================== CREATE DATABASE VIEWS ====================

// Create a view for active clients with their payment stats
db.createView(
  "client_stats",
  "clients",
  [
    {
      $match: { status: "active" }
    },
    {
      $lookup: {
        from: "payments",
        localField: "_id",
        foreignField: "clientId",
        as: "payments"
      }
    },
    {
      $addFields: {
        totalPayments: { $size: "$payments" },
        pendingPayments: {
          $size: {
            $filter: {
              input: "$payments",
              as: "payment",
              cond: { $eq: ["$$payment.status", "pending"] }
            }
          }
        },
        totalAmount: {
          $sum: {
            $map: {
              input: "$payments",
              as: "payment",
              in: "$$payment.amount"
            }
          }
        }
      }
    },
    {
      $project: {
        name: 1,
        email: 1,
        companyName: 1,
        totalPayments: 1,
        pendingPayments: 1,
        totalAmount: 1,
        addedBy: 1
      }
    }
  ]
);

// ==================== VALIDATION RULES ====================

// Add validation to users collection
db.runCommand({
  collMod: "users",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["email", "name", "companyName", "role"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "must be a valid email address"
        },
        role: {
          enum: ["user", "admin"],
          description: "must be either 'user' or 'admin'"
        },
        isActive: {
          bsonType: "bool",
          description: "must be a boolean value"
        }
      }
    }
  },
  validationLevel: "moderate"
});

// Add validation to clients collection
db.runCommand({
  collMod: "clients",
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "companyName", "addedBy", "status"],
      properties: {
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
          description: "must be a valid email address"
        },
        status: {
          enum: ["pending", "active", "rejected", "inactive"],
          description: "must be a valid status"
        }
      }
    }
  },
  validationLevel: "moderate"
});

// ==================== FINAL MESSAGE ====================

print("==========================================");
print("✅ MongoDB initialization completed!");
print("📊 Database: settleup");
print("👤 Admin: admin@settleup.com / Admin@123");
print("👤 Demo: demo@settleup.com / Demo@123");
print("🔐 Users created with secure passwords");
print("📈 Indexes created for optimal performance");
print("==========================================");