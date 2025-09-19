# 📞 Cloud Call System

A modern, scalable cloud-based call center management system built with Node.js, React, and TypeScript. Features include PBX integration, real-time call management, multi-tenant support, and comprehensive admin dashboards.

## 🌟 Features

- **🎯 Multi-Tenant Architecture**: Support for multiple organizations with isolated data
- **📞 Integrated Dialpad**: Full-featured softphone with DTMF support
- **👥 User Management**: Role-based access control (SuperAdmin, Admin, Supervisor, Agent, User)
- **📊 Real-time Dashboard**: Live call statistics and monitoring
- **🔧 PBX Integration**: SIP-based communication with extension management
- **💳 Billing & Payments**: Integrated PayPal and Stripe payment processing
- **📈 Analytics & Reports**: Comprehensive call analytics and reporting
- **🔒 Security**: JWT authentication, encrypted passwords, and secure sessions
- **📱 Responsive Design**: Works on desktop, tablet, and mobile devices

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   React + TS    │◄──►│   Node.js + TS  │◄──►│   MySQL 8.0     │
│   Port: 3000    │    │   Port: 3002    │    │   Port: 3306    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   SIP Server    │
                       │   Port: 5060    │
                       └─────────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Zustand** for state management
- **React Hot Toast** for notifications

### Backend
- **Node.js** with TypeScript
- **Express.js** web framework
- **Prisma ORM** for database management
- **JWT** for authentication
- **bcrypt** for password hashing
- **SIP.js** for VoIP communication

### Database
- **MySQL 8.0** for production
- **SQLite** for development (optional)

## 📋 Prerequisites

### Development
- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **MySQL** 8.0 or higher (or Docker)
- **Git** for version control

### Production
- **Ubuntu 24.04 LTS** server
- **4GB RAM** minimum
- **2 CPU cores** minimum
- **20GB storage** minimum
- **Domain name** with DNS access

---

# 🚀 Installation Guide

## 📦 Development Setup

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/cloud-call-system.git
cd cloud-call-system
```

### 2. Setup Database

#### Option A: Using MySQL (Recommended)
```bash
# Install MySQL 8.0
# Ubuntu/Debian:
sudo apt update
sudo apt install mysql-server

# macOS (using Homebrew):
brew install mysql

# Windows: Download from https://dev.mysql.com/downloads/mysql/

# Start MySQL service
sudo systemctl start mysql  # Linux
brew services start mysql   # macOS

# Create database and user
mysql -u root -p
```

```sql
CREATE DATABASE cloudcall_dev;
CREATE USER 'cloudcall_dev'@'localhost' IDENTIFIED BY 'dev_password_123';
GRANT ALL PRIVILEGES ON cloudcall_dev.* TO 'cloudcall_dev'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### Option B: Using Docker
```bash
# Run MySQL in Docker
docker run --name cloudcall-mysql \
  -e MYSQL_ROOT_PASSWORD=root_password \
  -e MYSQL_DATABASE=cloudcall_dev \
  -e MYSQL_USER=cloudcall_dev \
  -e MYSQL_PASSWORD=dev_password_123 \
  -p 3306:3306 \
  -d mysql:8.0
```

### 3. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit the .env file with your configuration
nano .env
```

**Configure `.env` file:**
```env
# Database
DATABASE_URL="mysql://cloudcall_dev:dev_password_123@localhost:3306/cloudcall_dev"

# JWT
JWT_SECRET="your-secret-key-for-development"
JWT_EXPIRES_IN="7d"

# Application
NODE_ENV="development"
PORT=3002
CORS_ORIGIN="http://localhost:3000"

# SIP
SIP_DOMAIN="pbx.cloudcall.local"
SIP_PORT=5060
```

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed the database with initial data
npx prisma db seed

# Start the backend server
npm run dev
```

The backend will be available at `http://localhost:3002`

### 4. Frontend Setup
```bash
# Open a new terminal and navigate to frontend
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env.local

# Edit the environment file
nano .env.local
```

**Configure `.env.local` file:**
```env
VITE_API_BASE_URL=http://localhost:3002/api
VITE_APP_NAME="Cloud Call System"
VITE_APP_VERSION="1.0.0"
```

```bash
# Start the frontend development server
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 5. Verify Installation
1. Open `http://localhost:3000` in your browser
2. You should see the Cloud Call System login page
3. Use the default superadmin credentials:
   - **Email**: `superadmin@cloudcall.com`
   - **Password**: `admin123!`

---

## 🌐 Production Deployment

### Quick Deployment Script
```bash
# Download and run the deployment script
curl -sSL https://raw.githubusercontent.com/yourusername/cloud-call-system/main/scripts/deploy.sh | bash
```

### Manual Production Setup

#### 1. Server Prerequisites
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git unzip software-properties-common mysql-server nginx certbot python3-certbot-nginx

# Install Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2
```

#### 2. Database Setup
```bash
# Secure MySQL installation
sudo mysql_secure_installation

# Create production database
sudo mysql -u root -p
```

```sql
CREATE DATABASE cloudcall_production;
CREATE USER 'cloudcall_user'@'localhost' IDENTIFIED BY 'secure_production_password';
GRANT ALL PRIVILEGES ON cloudcall_production.* TO 'cloudcall_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 3. Application Deployment
```bash
# Create application directory
sudo mkdir -p /var/www/cloudcall
sudo chown $USER:$USER /var/www/cloudcall
cd /var/www/cloudcall

# Clone repository
git clone https://github.com/yourusername/cloud-call-system.git .

# Setup backend
cd backend
npm install --production
cp .env.example .env.production
```

**Configure production environment:**
```env
DATABASE_URL="mysql://cloudcall_user:secure_production_password@localhost:3306/cloudcall_production"
JWT_SECRET="super-secure-jwt-secret-for-production"
NODE_ENV="production"
PORT=3002
CORS_ORIGIN="https://yourdomain.com"
```

```bash
# Run migrations and build
npx prisma generate
npx prisma migrate deploy
npm run build

# Setup frontend
cd ../frontend
npm install
cp .env.example .env.production
```

**Configure frontend environment:**
```env
VITE_API_BASE_URL=https://api.yourdomain.com
```

```bash
# Build frontend
npm run build
```

#### 4. Configure Nginx
```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/cloudcall
```

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/cloudcall/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# Backend API
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/cloudcall /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. SSL Certificate
```bash
# Install SSL certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com
```

#### 6. Process Management
```bash
cd /var/www/cloudcall

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'cloudcall-backend',
    cwd: '/var/www/cloudcall/backend',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 7. Firewall Configuration
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 5060/udp
sudo ufw --force enable
```

---

## 🔧 Development Commands

### Backend Commands
```bash
cd backend

# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm start           # Start production server

# Database
npx prisma studio   # Open database browser
npx prisma migrate dev  # Create and apply new migration
npx prisma db seed  # Seed database with test data
npx prisma generate # Generate Prisma client

# Testing
npm test           # Run tests
npm run test:watch # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

### Frontend Commands
```bash
cd frontend

# Development
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build

# Code Quality
npm run lint       # Run ESLint
npm run lint:fix   # Fix ESLint errors
npm run type-check # Run TypeScript checks
```

## 📁 Project Structure

```
cloud-call-system/
├── backend/                 # Backend Node.js application
│   ├── src/
│   │   ├── controllers/     # Route controllers
│   │   ├── middleware/      # Express middleware
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── services/        # Business logic
│   │   ├── utils/           # Utility functions
│   │   └── index.ts         # Application entry point
│   ├── prisma/
│   │   ├── migrations/      # Database migrations
│   │   ├── schema.prisma    # Database schema
│   │   └── seed.ts          # Database seeding
│   ├── package.json
│   └── .env.example
├── frontend/                # Frontend React application
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── common/      # Shared components
│   │   │   ├── forms/       # Form components
│   │   │   └── ui/          # UI components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── store/           # State management
│   │   ├── utils/           # Utility functions
│   │   └── App.tsx          # Main application component
│   ├── public/              # Static assets
│   ├── package.json
│   └── .env.example
├── docs/                    # Documentation
├── scripts/                 # Deployment and utility scripts
├── docker-compose.yml       # Docker development setup
├── README.md               # This file
└── LICENSE                 # License information
```

## 🐳 Docker Development Setup

### Using Docker Compose
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild services
docker-compose up --build
```

### Individual Docker Commands
```bash
# Build backend image
docker build -t cloudcall-backend ./backend

# Build frontend image
docker build -t cloudcall-frontend ./frontend

# Run MySQL container
docker run -d --name cloudcall-mysql \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=cloudcall_dev \
  -p 3306:3306 mysql:8.0
```

## 🧪 Testing

### Backend Testing
```bash
cd backend

# Run all tests
npm test

# Run specific test file
npm test -- user.test.ts

# Run tests with coverage
npm run test:coverage

# Run integration tests
npm run test:integration
```

### Frontend Testing
```bash
cd frontend

# Run component tests
npm test

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch
```

## 🔍 API Documentation

The API documentation is available at:
- **Development**: `http://localhost:3002/api/docs`
- **Production**: `https://api.yourdomain.com/docs`

### Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | User authentication |
| `/api/auth/register` | POST | User registration |
| `/api/users` | GET | List users |
| `/api/extensions` | GET | List extensions |
| `/api/calls` | GET | List calls |
| `/api/pbx/calls` | POST | Initiate call |
| `/api/pbx/status` | GET | PBX status |

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Error
```bash
# Check MySQL service
sudo systemctl status mysql

# Test connection
mysql -u cloudcall_dev -p cloudcall_dev

# Check environment variables
cat backend/.env
```

#### Frontend Build Errors
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Node.js version
node --version  # Should be 18.x.x or higher
```

#### Port Already in Use
```bash
# Find process using port 3002
lsof -i :3002

# Kill process
kill -9 <PID>

# Or use different port
PORT=3003 npm run dev
```

#### Permission Denied Errors
```bash
# Fix file permissions
sudo chown -R $USER:$USER /var/www/cloudcall

# Fix npm permissions
sudo chown -R $USER ~/.npm
```

### Debug Mode

#### Backend Debug
```bash
# Enable debug logging
DEBUG=* npm run dev

# Or specific modules
DEBUG=express:*,prisma:* npm run dev
```

#### Frontend Debug
```bash
# Open browser dev tools
# Check console for errors
# Use React Developer Tools extension
```

## 📊 Monitoring

### Application Monitoring
```bash
# Check process status
pm2 status

# View logs
pm2 logs

# Monitor resources
pm2 monit

# Restart application
pm2 restart all
```

### System Monitoring
```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check CPU usage
top

# Check network connections
netstat -tulpn
```

## 🔐 Security

### Best Practices
- Change default passwords
- Use strong JWT secrets
- Enable HTTPS in production
- Keep dependencies updated
- Use environment variables for secrets
- Implement rate limiting
- Regular security audits

### Security Checklist
- [ ] Database credentials secured
- [ ] JWT secret is strong and unique
- [ ] HTTPS enabled with valid certificates
- [ ] Firewall configured properly
- [ ] Regular backups scheduled
- [ ] Dependency vulnerabilities checked
- [ ] Rate limiting implemented
- [ ] Input validation in place

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 Support

- **Documentation**: [Wiki](https://github.com/yourusername/cloud-call-system/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/cloud-call-system/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/cloud-call-system/discussions)
- **Email**: support@yourdomain.com

## 🎯 Roadmap

- [ ] **v1.1**: Advanced call routing
- [ ] **v1.2**: Video calling support
- [ ] **v1.3**: Mobile application
- [ ] **v1.4**: AI-powered analytics
- [ ] **v1.5**: Multi-language support
- [ ] **v2.0**: Microservices architecture

---

**Built with ❤️ by the Cloud Call System Team**