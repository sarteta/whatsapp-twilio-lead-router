FROM node:20-alpine AS builder

WORKDIR /build

# better-sqlite3 needs a toolchain to compile.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev


FROM node:20-alpine

LABEL org.opencontainers.image.source="https://github.com/sarteta/whatsapp-twilio-lead-router"
LABEL org.opencontainers.image.description="Twilio SMS to WhatsApp lead-router with intent classification, for real-estate teams"
LABEL org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

COPY --from=builder /build/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY scripts ./scripts

RUN mkdir -p /app/data && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
