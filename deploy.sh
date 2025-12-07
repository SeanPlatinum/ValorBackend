#!/bin/bash

# Valor HVAC Backend Deployment Script
# Usage: ./deploy.sh [server-ip]

SERVER_IP="${1:-138.197.26.207}"
SERVER_USER="root"
APP_DIR="/opt/valor-backend"
SERVICE_NAME="valor-backend"

echo "🚀 Deploying Valor HVAC Backend to $SERVER_USER@$SERVER_IP"
echo "=========================================="

# Build the project locally first
echo "📦 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix errors before deploying."
    exit 1
fi

# Create deployment archive
echo "📦 Creating deployment package..."
tar -czf deploy.tar.gz \
    dist/ \
    package.json \
    package-lock.json \
    .env.example \
    tsconfig.json \
    README.md \
    --exclude='node_modules' \
    --exclude='.git'

# Transfer files to server
echo "📤 Uploading files to server..."
scp deploy.tar.gz $SERVER_USER@$SERVER_IP:/tmp/

# Run deployment commands on server
echo "🔧 Setting up on server..."
ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
    set -e
    
    # Create app directory
    mkdir -p /opt/valor-backend
    cd /opt/valor-backend
    
    # Extract files
    tar -xzf /tmp/deploy.tar.gz -C /opt/valor-backend
    rm /tmp/deploy.tar.gz
    
    # Install dependencies (production only)
    npm ci --production
    
    # Create .env if it doesn't exist
    if [ ! -f .env ]; then
        echo "⚠️  .env file not found. Creating from example..."
        cp .env.example .env
        echo "📝 Please edit /opt/valor-backend/.env with your configuration"
    fi
    
    # Create systemd service file
    cat > /etc/systemd/system/valor-backend.service << 'EOF'
[Unit]
Description=Valor HVAC Backend API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/valor-backend
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=valor-backend

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable valor-backend
    
    # Start or restart service
    if systemctl is-active --quiet valor-backend; then
        echo "🔄 Restarting service..."
        systemctl restart valor-backend
    else
        echo "▶️  Starting service..."
        systemctl start valor-backend
    fi
    
    # Show status
    sleep 2
    systemctl status valor-backend --no-pager
    
    echo "✅ Deployment complete!"
    echo "📝 Don't forget to:"
    echo "   1. Edit /opt/valor-backend/.env with your configuration"
    echo "   2. Restart service: systemctl restart valor-backend"
    echo "   3. Check logs: journalctl -u valor-backend -f"
ENDSSH

# Cleanup
rm -f deploy.tar.gz

echo ""
echo "✅ Deployment script completed!"
echo "📝 Next steps:"
echo "   1. SSH to server: ssh root@$SERVER_IP"
echo "   2. Edit .env: nano /opt/valor-backend/.env"
echo "   3. Restart: systemctl restart valor-backend"
echo "   4. Check status: systemctl status valor-backend"
