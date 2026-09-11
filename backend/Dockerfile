# --- deps: install once, reused by build ---
FROM node:20-alpine AS deps
WORKDIR /app
# Prisma's query engine needs libssl on alpine (musl)
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN npm ci

# --- build: generate Prisma client + compile TypeScript ---
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# No DB connection needed — this only codegens the client from schema.prisma
RUN npx prisma generate
RUN npm run build

# --- runner: prod deps only + compiled output ---
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
# Prisma generate patches @prisma/client with the actual engine + generated
# code — that lives in these two paths, not in package-lock, so pull the
# already-generated copy from the build stage over the fresh prod install.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

EXPOSE 9761
CMD ["node", "dist/main.js"]
