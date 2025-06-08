FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm && pnpm install

COPY . .

# ✨ Bắt buộc: Generate Prisma Client trước khi build
RUN npx prisma generate

# Build NestJS app
RUN pnpm run build

ENV PORT=3001
EXPOSE 3001

CMD ["pnpm", "run", "start:prod"]
