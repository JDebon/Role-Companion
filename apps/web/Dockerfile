FROM node:25-alpine
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/

RUN pnpm install --filter web

COPY tsconfig.base.json ./
COPY apps/web/ apps/web/

EXPOSE 5173
CMD ["pnpm", "--filter", "web", "dev", "--host"]
