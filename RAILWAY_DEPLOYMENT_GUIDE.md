# Railway Deployment Guide - EscaShop

## Overview
This guide covers deploying the entire EscaShop application (backend + frontend + database) to Railway.

## Prerequisites

1. **Railway Account**: Sign up at https://railway.app
2. **GitHub Repository**: Push your code to GitHub
3. **Railway CLI**: Install globally
   ```bash
   npm install -g @railway/cli
   ```

## Step 1: Prepare Your Repository

1. **Update .gitignore** to exclude sensitive files:
   ```gitignore
   .env
   .env.local
   .env.railway
   node_modules/
   dist/
   build/
   logs/
   uploads/
   ```

2. **Commit and push** all changes to GitHub:
   ```bash
   git add .
   git commit -m "Prepare for Railway deployment"
   git push origin main
   ```

## Step 2: Create Railway Project

### Option A: Through Railway Dashboard (Recommended)
1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your EscaShop repository
5. Railway will detect it's a monorepo and ask about services

### Option B: Through CLI
```bash
railway login
railway init
railway link
```

## Step 3: Setup Services

Railway will create separate services for each part:

### Backend Service
1. **Root Directory**: `/backend`
2. **Build Command**: `npm run build`
3. **Start Command**: `npm start`
4. **Port**: `5000`

### Frontend Service
1. **Root Directory**: `/frontend`
2. **Build Command**: `npm run build`
3. **Start Command**: `npx serve -s build -l 3000`
4. **Port**: `3000`

### Database Service
1. Click "Add Service"
2. Select "PostgreSQL"
3. Railway will automatically create a PostgreSQL database

## Step 4: Configure Environment Variables

### Backend Environment Variables
Set these in the Railway backend service:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL=${{ PGDATABASE_URL }}
JWT_SECRET=your-super-secure-jwt-secret-change-this
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-change-this
FRONTEND_URL=https://your-frontend-service.up.railway.app
SMS_PROVIDER=vonage
SMS_ENABLED=true
VONAGE_API_KEY=24580886
VONAGE_API_SECRET=0YSON3xZYOEWYLyf
EMAIL_SERVICE_ENABLED=true
EMAIL_SERVICE=gmail
EMAIL_USER=jefor16@gmail.com
EMAIL_PASSWORD=cutbcijqacobypak
GOOGLE_SHEETS_URL=https://script.google.com/macros/s/AKfycbxK6QzgW_7lZbNYknNyXVe4ogZvdByyqaHwfpoX4txyeTXVVmz498xxGBtuDCG_2xAi/exec
```

### Frontend Environment Variables
Set these in the Railway frontend service:

```env
NODE_ENV=production
REACT_APP_API_URL=https://your-backend-service.up.railway.app
```

## Step 5: Deploy

1. **Push to GitHub** - Railway auto-deploys on push
2. **Monitor Deployment** in Railway dashboard
3. **Check Logs** for any issues

## Step 6: Update URLs

After deployment:

1. **Copy Backend URL** from Railway dashboard
2. **Update Frontend Environment**: Set `REACT_APP_API_URL`
3. **Copy Frontend URL** from Railway dashboard  
4. **Update Backend Environment**: Set `FRONTEND_URL`
5. **Redeploy** both services

## Step 7: Database Setup

The database will be empty initially. You need to run migrations:

### Option A: Through Railway CLI
```bash
railway run npm run migrate
```

### Option B: Connect and run manually
1. Get database connection string from Railway
2. Connect using your preferred PostgreSQL client
3. Run your migration scripts

## Step 8: Test the Deployment

1. **Backend Health Check**: `https://your-backend-service.up.railway.app/health`
2. **Frontend**: `https://your-frontend-service.up.railway.app`
3. **Database Connection**: Check backend logs
4. **WebSocket**: Test real-time features
5. **Authentication**: Test login/logout
6. **Core Features**: Test queue management

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check build logs in Railway dashboard
   - Ensure all dependencies are in package.json
   - Check Node.js version compatibility

2. **Database Connection Issues**
   - Verify DATABASE_URL environment variable
   - Check if PostgreSQL service is running
   - Review backend logs for connection errors

3. **Frontend Can't Connect to Backend**
   - Verify REACT_APP_API_URL is correct
   - Check CORS settings in backend
   - Ensure both services are deployed

4. **WebSocket Issues**
   - Check if Socket.IO is configured for production
   - Verify WebSocket endpoint URLs
   - Check for proxy/load balancer issues

### Performance Optimization

1. **Enable Gzip Compression**
2. **Configure Caching Headers**
3. **Optimize Database Queries**
4. **Monitor Resource Usage**

## Cost Considerations

- **Starter Plan**: Free tier with limitations
- **Developer Plan**: $5/month per service
- **Team Plan**: $20/month per service

For production, consider the Developer plan or higher.

## Security Checklist

- [ ] Change all default passwords and secrets
- [ ] Enable HTTPS (Railway provides this automatically)
- [ ] Configure proper CORS settings
- [ ] Set up rate limiting
- [ ] Enable SQL injection protection
- [ ] Configure proper error handling (don't expose sensitive info)

## Backup Strategy

1. **Database Backups**: Railway provides automated backups
2. **Code Backups**: Keep your GitHub repository updated
3. **Environment Variables**: Document all critical settings

## Monitoring

1. **Railway Metrics**: Built-in monitoring
2. **Application Logs**: Available in Railway dashboard
3. **Health Checks**: Implement comprehensive health endpoints
4. **Alerts**: Configure notifications for failures

## Rollback Strategy

1. **Redeploy Previous Version**: Use Railway's deployment history
2. **Database Rollback**: Use Railway's database backups if needed
3. **Environment Rollback**: Revert environment variables if needed

## Next Steps After Deployment

1. **Custom Domain**: Configure your own domain
2. **SSL Certificate**: Railway provides automatic HTTPS
3. **Performance Monitoring**: Set up monitoring tools
4. **Scaling**: Configure auto-scaling if needed
5. **CI/CD Pipeline**: Set up automated testing and deployment
