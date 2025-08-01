# Multi-stage Docker build for Backend
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    curl \
    postgresql-client \
    tzdata

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm install
# Copy all necessary files
COPY src ./src
COPY tsconfig.json ./
COPY nodemon.json ./
COPY jest.config.js ./jest.config.js
COPY .env.example ./.env.example
# Copy package-scripts if it exists
COPY package-scripts.json ./package-scripts.json
# Create necessary directories
RUN mkdir -p logs uploads dist
EXPOSE 5000
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
ENV NODE_ENV=development
RUN npm install
COPY . .
RUN npm run build

# Production dependencies stage
FROM base AS production-deps
ENV NODE_ENV=production
RUN npm install --omit=dev && npm cache clean --force

# Production stage
FROM base AS production
ENV NODE_ENV=production

# Copy production dependencies
COPY --from=production-deps /app/node_modules ./node_modules

# Copy built application
COPY --from=build /app/dist ./dist
COPY package*.json ./
COPY src/migrate.ts ./src/

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/uploads /app/dist && \
    chown -R node:node /app/logs /app/uploads /app/dist

# Switch to non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

EXPOSE 5000
CMD ["npm", "start"]
