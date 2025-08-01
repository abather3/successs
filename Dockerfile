# Railway Backend Deployment - Root Level
FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl postgresql-client tzdata

# Copy backend package files
COPY backend/package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy pre-built backend application
COPY backend/dist ./dist
COPY backend/src ./src
COPY backend/tsconfig*.json ./

# Set up environment
ENV NODE_ENV=production
ENV PORT=5000

# Create directories
RUN mkdir -p logs uploads

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

EXPOSE $PORT
CMD ["npm", "start"]
