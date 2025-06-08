FROM node:20-alpine

WORKDIR /app

# Copy và cài đặt
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# Copy toàn bộ mã nguồn vào container
COPY . .

# (Nếu dùng .env để generate prisma client)
COPY .env .   # nếu cần DATABASE_URL trong prisma

# Generate Prisma Client trước khi build
RUN npx prisma generate

# Build NestJS
RUN pnpm run build

# Kiểm tra thư mục dist (debug)
RUN ls -la dist

ENV PORT=3001
EXPOSE 3001

CMD ["pnpm", "run", "start:prod"]
