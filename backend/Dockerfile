FROM node:20-alpine

# Güvenlik: root olmayan kullanıcı oluştur
RUN addgroup -S woltix && adduser -S woltix -G woltix

WORKDIR /app

# Önce package.json'ları kopyala (layer caching için)
COPY package*.json ./
RUN npm install --only=production && npm cache clean --force

# Kaynak kodları kopyala
COPY src ./src
COPY .env.example ./.env.example

# Güvenlik: sadece gerekli dosyalara izin ver
RUN chown -R woltix:woltix /app

# Root olmayan kullanıcıya geç
USER woltix

EXPOSE 4000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

CMD ["node", "src/index.js"]
