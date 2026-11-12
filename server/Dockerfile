# Multi-stage Dockerfile for Cloud Run
# Stage 1: Dependencies builder
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Stage 2: Production runner
FROM node:20-slim
WORKDIR /app

# Cloud Run injects PORT (default 8080)
ENV PORT=8080
ENV NODE_ENV=production

# Copy dependencies and application code
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY server.js ./
COPY lib ./lib

# Run as non-root user for security
USER node

EXPOSE 8080

CMD ["node", "server.js"]
