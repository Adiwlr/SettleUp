cat > setup.sh << 'EOF'
#!/bin/bash

echo "🚀 Setting up SettleUp Application..."

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "📚 Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "📚 Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Create essential backend files if they don't exist
echo "📁 Creating essential files..."

# Create minimal backend app.js
mkdir -p backend/src
cat > backend/src/app.js << 'APPJS'
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Simple test route
app.get('/', (req, res) => {
    res.json({ 
        message: 'SettleUp API is running!',
        version: '1.0.0'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes placeholder
app.get('/api/test', (req, res) => {
    res.json({ message: 'API is working!' });
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/settleup')
    .then(() => {
        console.log('✅ MongoDB connected');
        app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
    });
APPJS

# Create minimal frontend App.js
mkdir -p frontend/src
cat > frontend/src/App.js << 'APPJSX'
import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>🚀 SettleUp Application</h1>
        <p>Your payment management platform is setting up...</p>
        <p>Backend API: <a href="http://localhost:5000" target="_blank" rel="noopener noreferrer">http://localhost:5000</a></p>
        <div style={{ marginTop: '20px' }}>
          <h3>Next Steps:</h3>
          <ol style={{ textAlign: 'left', display: 'inline-block' }}>
            <li>Wait for containers to start</li>
            <li>Check backend: <a href="http://localhost:5000/health">Health Check</a></li>
            <li>Check frontend: This page</li>
            <li>Add more features from the complete code</li>
          </ol>
        </div>
      </header>
    </div>
  );
}

export default App;
APPJSX

# Create frontend App.css
cat > frontend/src/App.css << 'APPCSS'
.App {
  text-align: center;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
}

.App-header {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 40px;
  max-width: 800px;
  width: 90%;
}

.App-header h1 {
  font-size: 3rem;
  margin-bottom: 20px;
}

.App-header p {
  font-size: 1.2rem;
  margin: 10px 0;
}

.App-header a {
  color: #61dafb;
  text-decoration: none;
}

.App-header a:hover {
  text-decoration: underline;
}

ol {
  margin: 20px auto;
  padding-left: 20px;
}

li {
  margin: 10px 0;
  font-size: 1.1rem;
}
APPCSS

# Create frontend index.js
cat > frontend/src/index.js << 'INDEXJS'
import React from 'react';
import ReactDOM from 'react-dom/client';
import './App.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
INDEXJS

# Create frontend public/index.html
mkdir -p frontend/public
cat > frontend/public/index.html << 'HTML'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="SettleUp - Payment Management Platform" />
    <title>SettleUp</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
HTML

echo "🐳 Starting Docker containers..."
docker-compose up -d

echo "⏳ Waiting for services to start..."
sleep 10

echo "✅ Setup complete!"
echo ""
echo "🌐 Application URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend API: http://localhost:5000"
echo "   API Health: http://localhost:5000/health"
echo ""
echo "📝 To view logs:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 To stop the application:"
echo "   docker-compose down"
EOF

chmod +x setup.sh