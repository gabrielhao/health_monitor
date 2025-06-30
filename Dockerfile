# Multi-stage Dockerfile for Vue.js Frontend + Node.js Backend
# Build arguments for flexibility
ARG NODE_VERSION=22
ARG ALPINE_VERSION=alpine

# Frontend build stage
FROM node:${NODE_VERSION}-${ALPINE_VERSION} AS frontend-builder

# Set working directory for frontend build
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install frontend dependencies
RUN npm ci --only=production=false

# Copy all necessary config files for frontend build
COPY vite.config.ts ./
COPY tsconfig*.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY eslint_new.config.js ./
COPY vitest.config.ts ./
COPY vitest.integration.config.ts ./
COPY index.html ./

# Copy source directories
COPY src/ ./src/
COPY public/ ./public/

# Build frontend for production
RUN npm run build

# Backend build stage
FROM node:${NODE_VERSION}-${ALPINE_VERSION} AS backend-builder

# Set working directory for backend build
WORKDIR /app

# Copy backend package files first for better layer caching
COPY backend-service/package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci --only=production=false

# Copy backend TypeScript config
COPY backend-service/tsconfig.json ./

# Copy backend source code
COPY backend-service/src/ ./src/

# Build backend TypeScript
RUN npm run build

# Production stage
FROM node:${NODE_VERSION}-${ALPINE_VERSION} AS production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy backend package files and install only production dependencies
COPY backend-service/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built backend from backend-builder stage
COPY --from=backend-builder /app/dist ./dist

# Copy built frontend from frontend-builder stage
COPY --from=frontend-builder /app/dist ./public

# Create necessary directories
RUN mkdir -p logs

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001 -G nodejs

# Change ownership of the app directory to non-root user
RUN chown -R appuser:nodejs /app

# Switch to non-root user
USER appuser

# Expose port (configurable via build arg)
ARG PORT=3001
EXPOSE ${PORT}

# Environment variables
ENV NODE_ENV=production
ENV PORT=${PORT}

# Health check with configurable port
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3001) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"] 