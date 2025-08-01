# Production Railway Docker deployment - No build phase
FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl postgresql-client tzdata

# Copy package files and install production dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copy pre-built application files
COPY backend/dist ./dist

# Set up environment
ENV NODE_ENV=production
ENV PORT=5000

# Create directories
RUN mkdir -p logs uploads

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

EXPOSE $PORT
CMD ["npm", "run", "start:prod"]
