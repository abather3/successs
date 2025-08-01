# ESCashop Nginx Configuration

This directory contains nginx configurations for both development and production environments.

## 📁 Directory Structure

```
nginx/
├── nginx.dev.conf      # Development configuration
├── nginx.prod.conf     # Production configuration  
├── ssl/               # SSL certificates directory
│   ├── cert.pem       # SSL certificate (production)
│   └── key.pem        # SSL private key (production)
└── README.md          # This file
```

## 🚀 Quick Start

### Development Setup

1. **Automatic Setup (Recommended)**
   ```powershell
   # Run the setup script
   .\setup-nginx.ps1
   ```

2. **Manual Setup**
   ```bash
   # Start all services with nginx
   docker-compose -f docker-compose.dev.yml -f docker-compose.override.yml up -d
   ```

3. **Access your application**
   - Frontend: http://localhost
   - Backend API: http://localhost/api
   - Health Check: http://localhost/health

### Production Setup

1. **Update Domain Configuration**
   Edit `nginx.prod.conf` and replace `your-domain.com` with your actual domain.

2. **Add SSL Certificates**
   Place your SSL certificates in the `ssl/` directory:
   - `cert.pem` - Your SSL certificate
   - `key.pem` - Your SSL private key

3. **Deploy**
   ```powershell
   .\setup-nginx.ps1 -Environment production -Domain your-domain.com
   ```

## ⚙️ Configuration Details

### Development Configuration (`nginx.dev.conf`)

- **Port**: 80 (HTTP only)
- **Domain**: localhost
- **Features**:
  - API proxying to backend:5000
  - Frontend proxying to frontend:3000
  - WebSocket support
  - React Router support
  - Gzip compression
  - Basic optimization

### Production Configuration (`nginx.prod.conf`)

- **Ports**: 80 (HTTP) + 443 (HTTPS)
- **Domain**: Configurable
- **Features**:
  - HTTPS with SSL/TLS
  - HTTP to HTTPS redirect
  - Rate limiting
  - Security headers
  - Static asset caching
  - Enhanced performance optimization
  - Comprehensive logging

## 🔧 Customization

### Adding Custom Headers

Add custom headers in the server block:
```nginx
add_header X-Custom-Header "Your-Value" always;
```

### Modifying Rate Limits

Adjust rate limiting in the production config:
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
```

### Static File Caching

Modify caching rules for different file types:
```nginx
location ~* \.(js|css|png|jpg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## 🔍 Troubleshooting

### Common Issues

1. **502 Bad Gateway**
   - Check if backend/frontend containers are running
   - Verify container names match nginx upstream configuration
   - Check network connectivity between containers

2. **SSL Certificate Issues**
   - Ensure certificates are in the correct location (`nginx/ssl/`)
   - Verify certificate file permissions
   - Check certificate validity: `openssl x509 -in cert.pem -text -noout`

3. **WebSocket Connection Issues**
   - Verify WebSocket proxy configuration
   - Check browser console for WebSocket errors
   - Ensure proper headers are set for WebSocket upgrade

### Debugging Commands

```bash
# Check nginx container logs
docker logs escashop_nginx_dev

# Test nginx configuration
docker exec escashop_nginx_dev nginx -t

# Reload nginx configuration
docker exec escashop_nginx_dev nginx -s reload

# Check container connectivity
docker exec escashop_nginx_dev nslookup escashop_backend_dev
```

## 📊 Monitoring

### Health Checks

The nginx container includes health checks that verify backend connectivity:
```bash
# Check nginx health
docker exec escashop_nginx_dev wget --quiet --tries=1 --spider http://backend:5000/health
```

### Log Analysis

Monitor nginx access and error logs:
```bash
# View access logs
docker exec escashop_nginx_dev tail -f /var/log/nginx/access.log

# View error logs  
docker exec escashop_nginx_dev tail -f /var/log/nginx/error.log
```

## 🔐 Security

### Production Security Features

- **HTTPS Only**: Forces HTTPS in production
- **Security Headers**: Implements OWASP recommendations
- **Rate Limiting**: Prevents API abuse
- **HSTS**: HTTP Strict Transport Security
- **CSP**: Content Security Policy

### Security Headers Included

```nginx
X-Frame-Options: SAMEORIGIN
X-XSS-Protection: 1; mode=block
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer-when-downgrade
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## 🚀 Performance Optimization

### Enabled Optimizations

- **Gzip Compression**: Reduces bandwidth usage
- **Keep-Alive**: Reuses connections
- **Upstream Keepalive**: Connection pooling to backend
- **Sendfile**: Efficient file serving
- **TCP No-Delay**: Reduces latency

### Performance Monitoring

Monitor performance metrics:
```bash
# Check connection statistics
docker exec escashop_nginx_dev ss -tuln

# Monitor system resources
docker stats escashop_nginx_dev
```

## 📝 Environment Variables

The nginx configuration supports environment-based customization through docker-compose files:

- `NGINX_CONF`: Specify which configuration file to use
- `SSL_CERT_PATH`: Custom SSL certificate path
- `RATE_LIMIT_API`: API rate limit configuration
- `RATE_LIMIT_AUTH`: Authentication rate limit configuration

## 🔄 Updates and Maintenance

### Updating Configuration

1. Modify the appropriate `.conf` file
2. Test the configuration: `docker exec escashop_nginx_dev nginx -t`
3. Reload: `docker exec escashop_nginx_dev nginx -s reload`

### Certificate Renewal

For Let's Encrypt certificates:
```bash
# Renew certificates (example with certbot)
certbot renew --webroot -w /var/www/html

# Reload nginx after renewal
docker exec escashop_nginx_dev nginx -s reload
```

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review nginx error logs
3. Verify all containers are healthy
4. Ensure network connectivity between services

For additional help, please refer to the main project documentation or create an issue in the project repository.
