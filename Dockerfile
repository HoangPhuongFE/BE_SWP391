FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

COPY . .

RUN npx prisma generate

# Build trước khi prune!
RUN pnpm run build

# (Nếu cần seed, thêm các dòng này trước prune)
 RUN pnpm add -D ts-node typescript
# RUN pnpm run seed

# Sau build mới prune để nhẹ image
RUN pnpm prune --prod

RUN ls -la dist/
RUN ls -la dist/src/

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/src/main"]
