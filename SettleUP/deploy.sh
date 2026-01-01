#!/bin/bash

# SettleUp VPS Deployment Script
# Usage: bash deploy.sh your-vps-ip

set -e

VPS_IP=$1
DEPLOY_USER="root"

if [ -z "$VPS_IP" ]; then
    echo "Usage: bash deploy.sh <vps-ip>"
    exit 1
fi

echo "🚀 Deploying SettleUp to $VPS_IP..."

# Copy files to VPS
echo "📤 Uploading files to VPS..."
scp -r ./* $DEPLOY_USER@$VPS_IP:/opt/settleup/

# Setup script on VPS
ssh $DEPLOY_USER@$VPS_IP << 'EOF'
    cd /opt/settleup
    
    # Install Docker if not installed
    if ! command -v docker &> /dev/null; then
        echo "📦 Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        usermod -aG docker $USER
    fi
    
    # Install Docker Compose if not installed
    if ! command -v docker-compose &> /dev/null; then
        echo "📦 Installing Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
    fi
    
    # Create SSL certificates (Let's Encrypt would be used in production)
    mkdir -p ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/private.key \
        -out ssl/certificate.crt \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=settleup.com"
    
    # Set proper permissions
    chmod 600 ssl/*
    
    # Start the application
    echo "🐳 Starting SettleUp..."
    docker-compose up -d --build
    
    # Create admin user
    echo "👤 Creating admin user..."
    sleep 30
    docker-compose exec backend node -e "
        const mongoose = require('mongoose');
        const User = require('./src/models/User');
        
        mongoose.connect('mongodb://admin:password123@mongodb:27017/settleup?authSource=admin')
            .then(async () => {
                const adminExists = await User.findOne({ email: 'admin@settleup.com' });
                if (!adminExists) {
                    const admin = new User({
                        email: 'admin@settleup.com',
                        password: 'Admin@123',
                        name: 'System Admin',
                        companyName: 'SettleUp',
                        role: 'admin',
                        region: {
                            timezone: 'UTC',
                            currency: 'USD',
                            country: 'Global'
                        }
                    });
                    await admin.save();
                    console.log('✅ Admin user created');
                } else {
                    console.log('✅ Admin user already exists');
                }
                process.exit(0);
            })
            .catch(err => {
                console.error('❌ Error:', err);
                process.exit(1);
            });
    "
EOF

echo "✅ Deployment complete!"
echo ""
echo "🌐 Access your application at: http://$VPS_IP"
echo "🔧 Admin login: admin@settleup.com / Admin@123"
echo ""
echo "📊 To monitor logs:"
echo "   ssh root@$VPS_IP 'cd /opt/settleup && docker-compose logs -f'"