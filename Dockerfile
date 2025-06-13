FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

COPY . .

RUN npx prisma generate

# --- Thêm bước này để seed ---
# 1. Cài ts-node và typescript để seed (devDeps)
RUN pnpm add -D ts-node typescript

# 2. Nếu muốn seed luôn khi build image:
# RUN pnpm run seed
# hoặc:
# RUN npx prisma db seed

# Hoặc bạn seed thủ công sau khi container chạy (xem hướng dẫn bên dưới)
# Sau seed thì prune luôn devDeps
RUN pnpm prune --prod

RUN pnpm run build

RUN ls -la dist/
RUN ls -la dist/src/

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/src/main"]
