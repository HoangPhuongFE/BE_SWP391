FROM node:20-alpine

WORKDIR /app

# Copy file cấu hình trước
COPY package.json pnpm-lock.yaml ./

# Cài pnpm và dependencies
RUN npm install -g pnpm && pnpm install

# Copy toàn bộ source sau khi đã install xong
COPY . .

# Build NestJS app
RUN pnpm run build

# Kiểm tra dist tồn tại (debug)
RUN ls -la dist

# Thiết lập PORT và expose
ENV PORT=3001
EXPOSE 3001

# Khởi chạy ứng dụng
CMD ["pnpm", "run", "start:prod"]
