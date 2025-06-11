FROM node:20-alpine

WORKDIR /app

# Copy package files và cài đặt
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# Copy file env trước khi generate prisma
COPY .env .env

# Copy toàn bộ mã nguồn
COPY . .

# Generate Prisma Client trước khi build
RUN npx prisma generate

# Build NestJS
RUN pnpm run build

# Kiểm tra thư mục dist (debug)
RUN ls -la dist

ENV PORT=3001
EXPOSE 3001

CMD ["pnpm", "run", "start:prod"]
