FROM node:24-slim AS base
WORKDIR /app
# O Prisma precisa do OpenSSL (a imagem slim não traz)
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

# 1) Dependências de produção
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 2) Gera o Prisma Client (não conecta ao banco, mas o config exige a variável definida)
FROM deps AS generate
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate

# 3) Imagem final
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=generate /app/generated ./generated
COPY package.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Aplica migrations pendentes e sobe a API. O "exec" faz o Node virar o processo principal,
# o que é necessário para ele receber o SIGTERM e encerrar graciosamente.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node src/server.js"]