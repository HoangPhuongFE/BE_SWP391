FROM node:20-alpine3.20

WORKDIR /app

COPY package.json /app
COPY pnpm-lock.yaml /app

RUN npm install -g pnpm

RUN pnpm install

COPY . /app

RUN npx prisma generate


RUN pnpm run build

CMD ["pnpm", "run", "start:prod"]