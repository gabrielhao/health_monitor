#!/bin/bash

# Backend Service Setup Script
# This script sets up the backend service with all necessary dependencies and configuration

set -e

echo "🚀 Setting up Backend Service..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ Created .env file. Please configure your environment variables."
else
    echo "✅ .env file already exists"
fi

# Build the project
echo "🔨 Building the project..."
npm run build

echo ""
echo "🎉 Backend Service setup complete!"
echo ""
echo "Next steps:"
echo "1. Configure your environment variables in .env"
echo "2. Start the development server: npm run dev"
echo "3. The service will be available at http://localhost:3001"
echo ""
echo "Available scripts:"
echo "  npm run dev          - Start development server"
echo "  npm run build        - Build for production"
echo "  npm run start        - Start production server"
echo "  npm run test         - Run tests"
echo "  npm run lint         - Run linter"
echo "  npm run type-check   - Run TypeScript type checking"
echo ""
echo "Service endpoints:"
echo "  Health check:        http://localhost:3001/health"
echo "  Upload API:          http://localhost:3001/api/upload"
echo "  Processing API:      http://localhost:3001/api/processing"
echo ""
echo "For more information, see README.md" 