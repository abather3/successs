# Render Deployment Guide - EscaShop

## Overview
This guide covers deploying the entire EscaShop application (backend + frontend + database) to Render.

## Prerequisites

1. **Render Account**: Sign up at https://render.com
2. **GitHub Repository**: Push your code to GitHub
3. **Render CLI** (optional): Install for advanced operations
   ```bash
   npm install -g @render/cli
   ```

## Step 1: Prepare Your Repository

1. **Update .gitignore** to exclude sensitive files:
   ```gitignore
   .env
   .env.local
   .env.render
   node_modules/
   dist/
   build/
   logs/
   uploads/
   ```

2. **Commit and push** all changes to GitHub:
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

## Step 2: Create Services on Render

### Method A: Using render.yaml (Blueprint)
1. Add the provided `render.yaml` file to your repository root
2. Go to https://render.com/dashboard
3. Click "New" → "Blueprint"
4. Connect your GitHub repository
5. Render will create all services automatically

### Method B: Manual Setup

#### Create Database Service
1. Go to https://render.com/dashboard
2. Click "New" → "PostgreSQL"
3. Name: `escashop-database`
4. Database Name: `escashop`
5. User: `escashop_user`
6. Region: Choose closest to your users
7. Plan: Free (for testing) or Starter ($7/month)

#### Create Backend Service
1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `escashop-backend`
   - **Environment**: `Node`
   - **Region**: Same as database
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free (for testing) or Starter ($7/month)

#### Create Frontend Service  
1. Click "New" → "Static Site"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `escashop-frontend`
   - **Environment**: `Static Site`
   - **Region**: Same as backend
   - **Branch**: `main`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm ci && npm run build`
   - **Publish Directory**: `build`

## Step 3: Configure Environment Variables

### Backend Environment Variables
Set these in the Render backend service settings:

```env
NODE_ENV=production
PORT=10000
DATABASE_URL=<automatic-from-postgres-service>
JWT_SECRET=your-super-secure-jwt-secret-change-this
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-change-this
FRONTEND_URL=https://escashop-frontend.onrender.com
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
Set these in the Render frontend service settings:

```env
REACT_APP_API_URL=https://escashop-backend.onrender.com
```

## Step 4: Deploy

Render automatically deploys when you push to GitHub:

1. **Push to GitHub** - triggers automatic deployment
2. **Monitor Deployment** in Render dashboard
3. **Check Logs** for any build or runtime issues

## Step 5: Database Setup

The PostgreSQL database will be empty initially:

### Option A: Using psql
1. Get database connection details from Render dashboard
2. Connect using psql:
   ```bash
   psql postgresql://username:password@hostname:port/database
   ```
3. Run your SQL migration scripts

### Option B: Using pgAdmin or similar GUI tool
1. Use connection details from Render dashboard
2. Import your database schema
3. Run necessary seed data scripts

### Option C: Application-based migration
Update your backend to run migrations on startup:

```javascript
// In your backend startup code
if (process.env.NODE_ENV === 'production') {
  await runMigrations();
}
```

## Step 6: Update Service URLs

After all services are deployed:

1. **Copy Backend URL**: `https://escashop-backend.onrender.com`
2. **Copy Frontend URL**: `https://escashop-frontend.onrender.com`
3. **Update Environment Variables**:
   - Backend: Update `FRONTEND_URL`
   - Frontend: Update `REACT_APP_API_URL`
4. **Redeploy**: Push changes to trigger redeployment

## Step 7: Test the Deployment

1. **Backend Health Check**: `https://escashop-backend.onrender.com/health`
2. **Frontend**: `https://escashop-frontend.onrender.com`
3. **Database Connection**: Check backend logs
4. **WebSocket**: Test real-time features
5. **Authentication**: Test login/logout
6. **Core Features**: Test queue management

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check build logs in Render dashboard
   - Ensure all dependencies are in package.json
   - Verify Node.js version compatibility

2. **Database Connection Issues**
   - Check DATABASE_URL environment variable
   - Verify PostgreSQL service is running
   - Review connection limits (100 for free tier)

3. **Frontend Build Issues**
   - Check for TypeScript errors
   - Verify all environment variables are set
   - Check React build process

4. **Cold Start Delays**
   - Free tier services sleep after 15 minutes of inactivity
   - Consider paid plan for production use
   - Implement health check endpoints

5. **WebSocket Connection Issues**
   - Render supports WebSocket on all plans
   - Check Socket.IO configuration for production
   - Verify CORS settings

### Performance Optimization

1. **Enable HTTP/2**: Automatic on Render
2. **Compression**: Configure in your backend
3. **Static Asset Caching**: Automatic for static sites
4. **Database Indexing**: Optimize your queries
5. **Connection Pooling**: Important for database performance

## Cost Considerations

### Free Tier Limitations
- **Web Services**: 750 hours/month per service
- **Static Sites**: Unlimited bandwidth
- **PostgreSQL**: 1GB storage, 100 concurrent connections
- **Sleep after 15 minutes** of inactivity

### Paid Plans
- **Starter**: $7/month per web service
- **Standard**: $25/month per web service
- **PostgreSQL**: $7/month for 10GB storage

## Security Checklist

- [ ] Use strong, unique secrets for JWT tokens
- [ ] Configure proper CORS settings
- [ ] Enable HTTPS (automatic on Render)
- [ ] Set up proper error handling
- [ ] Use environment variables for all secrets
- [ ] Enable database SSL connections
- [ ] Set up rate limiting
- [ ] Configure security headers

## Monitoring and Logging

1. **Built-in Monitoring**: Available in Render dashboard
2. **Custom Logging**: Use structured logging in your application
3. **Error Tracking**: Integrate with services like Sentry
4. **Performance Monitoring**: Use APM tools like New Relic
5. **Uptime Monitoring**: Use external services like Pingdom

## Backup Strategy

1. **Database Backups**:
   - Manual backups via Render dashboard
   - Automated backups with paid plans
   - Export data regularly for additional safety

2. **Code Backups**: 
   - Keep GitHub repository updated
   - Tag releases for easy rollback

3. **Environment Variables**:
   - Document all settings
   - Keep secure backup of secrets

## Scaling Considerations

1. **Horizontal Scaling**: Deploy multiple instances
2. **Vertical Scaling**: Upgrade to higher-tier plans
3. **Database Scaling**: Consider connection pooling
4. **CDN**: Use Render's global CDN for static assets
5. **Caching**: Implement Redis for session/data caching

## Deployment Workflow

### Development Workflow
```bash
# 1. Make changes locally
git add .
git commit -m "Feature: Add new functionality"

# 2. Test locally
npm run dev

# 3. Push to trigger deployment
git push origin main

# 4. Monitor deployment in Render dashboard
# 5. Test production deployment
```

### Production Deployment Checklist

- [ ] All tests passing locally
- [ ] Environment variables updated
- [ ] Database migrations ready
- [ ] Security configurations verified
- [ ] Performance testing completed
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented

## Rollback Strategy

1. **Code Rollback**: 
   ```bash
   git revert <commit-hash>
   git push origin main
   ```

2. **Database Rollback**: 
   - Use database backups
   - Run rollback migrations if available

3. **Environment Variable Rollback**:
   - Update through Render dashboard
   - Redeploy services

## Advanced Configuration

### Custom Domains
1. Go to service settings in Render dashboard
2. Add custom domain
3. Configure DNS records as instructed
4. SSL certificates are handled automatically

### Auto-Deploy
- Enabled by default
- Disable for manual deployment control
- Configure branch-specific deployments

### Health Checks
Implement comprehensive health check endpoints:

```javascript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: process.env.npm_package_version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

## Support and Resources

- **Render Documentation**: https://render.com/docs
- **Community**: https://community.render.com
- **Status Page**: https://status.render.com
- **Support**: Available through dashboard (paid plans get priority)

This guide provides a comprehensive approach to deploying your EscaShop application on Render with proper configuration, monitoring, and maintenance practices.
