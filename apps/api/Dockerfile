FROM node:25-alpine
WORKDIR /app

RUN npm install -g pnpm

# Copy workspace manifests first (layer cache)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/

RUN pnpm install

# Copy source (overridden by volume mounts in dev)
COPY tsconfig.base.json ./
COPY apps/api/ apps/api/
COPY packages/db/ packages/db/

EXPOSE 3000
