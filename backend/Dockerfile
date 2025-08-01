# Simplified single-stage Docker build for Railway
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    curl \
    postgresql-client \
    tzdata

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm install

# Copy all source files
COPY . .

# Build the TypeScript application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Set up Railway-compatible port
ENV PORT=5000
ENV NODE_ENV=production

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/uploads /app/dist && \
    chown -R node:node /app/logs /app/uploads /app/dist

# Switch to non-root user
USER node

# Health check with dynamic port
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT:-5000}/health || exit 1

EXPOSE $PORT
CMD ["npm", "start"]
