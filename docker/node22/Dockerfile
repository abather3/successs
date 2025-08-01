# Node.js 22 Testing Environment
FROM node:22.5.1-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    bash \
    curl \
    postgresql-client \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Install global utilities
RUN npm install -g npm@latest \
    pnpm@latest \
    yarn@latest

# Create test user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S testuser -u 1001 -G nodejs

# Environment variables
ENV NODE_VERSION=22.5.1
ENV NODE_ENV=test
ENV CI=true

# Copy testing scripts
COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh

# Switch to test user
USER testuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node --version || exit 1

CMD ["/bin/bash"]
