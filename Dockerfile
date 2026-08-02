# Stage 1: Build the Next.js static files
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Create the final Python container
FROM python:3.12-slim

WORKDIR /app

# Install media-types and curl for proper MIME type handling
RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
    apt-get install -y --no-install-recommends media-types curl && \
    rm -rf /var/lib/apt/lists/*
    
# AWS Lambda Web Adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:1.0.0 /lambda-adapter /opt/extensions/lambda-adapter

# Environment variables for Lambda Web Adapter
ENV PORT=8000
ENV AWS_LWA_READINESS_CHECK_PATH=/health
ENV AWS_LWA_READINESS_CHECK_PORT=8000
ENV NODE_ENV=production

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY api/server.py .
# COPY documents ./documents
COPY --from=frontend-builder /app/out ./static

# Remove health check for Lambda (not needed with Web Adapter)
# HEALTHCHECK is not compatible with Lambda

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
