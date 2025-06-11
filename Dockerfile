FROM node:20-alpine

WORKDIR /app

# Copy package files và cài đặt
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# Inject build-time env cho Prisma generate
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Copy toàn bộ mã nguồn (sau khi env đã có)
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS
RUN pnpm run build

# Debug dist (tùy chọn)
RUN ls -la dist

ENV PORT=3001
EXPOSE 3001

CMD ["pnpm", "run", "start:prod"]
