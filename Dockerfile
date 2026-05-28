FROM node:22-bookworm AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice \
    poppler-utils \
    fonts-dejavu \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV SOFFICE_PATH=/usr/bin/soffice
ENV PDFTOPPM_PATH=/usr/bin/pdftoppm

EXPOSE 3000

CMD ["node", "dist/app.js"]
