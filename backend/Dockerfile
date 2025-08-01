# Minimal Railway Docker build
FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache curl postgresql-client tzdata

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source and build
COPY . .
RUN npm install typescript && npm run build

# Set up environment
ENV NODE_ENV=production
ENV PORT=5000

# Create directories
RUN mkdir -p logs uploads dist

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

EXPOSE $PORT
CMD ["npm", "start"]
