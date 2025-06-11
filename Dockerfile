FROM node:20-alpine

WORKDIR /app

# Copy package files và cài đặt dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Inject build-time env cho Prisma generate
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Copy toàn bộ mã nguồn
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS application
RUN pnpm run build

# Debug: Kiểm tra build output
RUN echo "=== Build completed. Checking dist directory ===" && \
    ls -la dist/ && \
    echo "=== Checking main file ===" && \
    test -f dist/main.js && echo "main.js found!" || echo "main.js NOT found!"

# Clean up dev dependencies để giảm image size (optional)
RUN pnpm prune --prod

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/main"]