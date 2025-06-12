FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

COPY . .

RUN npx prisma generate
RUN pnpm run build

RUN ls -la dist/
RUN ls -la dist/src/   # kiểm tra nếu cần

RUN pnpm prune --prod

ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/main"]   # hoặc dist/src/main nếu build ra đó
