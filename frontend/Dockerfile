# Multi-stage Docker build for Frontend
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
# Memory optimization for development - increased from 2048 to 4096
ENV NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=256"
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production dependencies stage
FROM base AS production-deps
ENV NODE_ENV=production
RUN npm install --omit=dev && npm cache clean --force

# Build stage
FROM base AS build
ENV NODE_ENV=production
# Memory optimization for build
ENV NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=256"
RUN npm install
COPY . .
RUN npm run build

# Production stage
FROM base AS production
ENV NODE_ENV=production

# Copy production dependencies
COPY --from=production-deps /app/node_modules ./node_modules

# Copy built application
COPY --from=build /app/build ./build

# Install serve to run the production build
RUN npm install -g serve

# Switch to non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

EXPOSE 3000
CMD ["serve", "-s", "build", "-l", "3000"]
