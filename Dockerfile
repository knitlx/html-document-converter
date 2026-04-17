# Использовать базовый образ Node.js (на основе Debian Bookworm, аналогичный базовой системе Railway)
FROM node:22-bookworm-slim

# Установить рабочую директорию
WORKDIR /app

# Установить системные зависимости для Puppeteer и шрифтов
# Это общие зависимости для headless Chrome в системах на базе Debian
RUN apt-get update -y && \
    apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libgconf-2-4 \
    libgdk-pixbuf-2.0-0 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxkbcommon0 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    # Пакеты шрифтов для эмодзи и общей поддержки Unicode
    fonts-noto \
    fonts-noto-color-emoji \
    fonts-dejavu \
    fontconfig \
    xfonts-utils \
    # Установить сам Chromium
    chromium \
    --no-install-recommends && \
    # Очистить кэши apt для уменьшения размера образа
    rm -rf /var/lib/apt/lists/* && \
    # Перестроить кэш шрифтов
    fc-cache -f -v

# Скопировать package.json и package-lock.json сначала, чтобы использовать кэш Docker
COPY package.json ./
COPY package-lock.json ./

# Установить зависимости Node.js
# PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true, чтобы предотвратить загрузку Puppeteer собственного Chromium
# Мы будем полагаться на тот, который поставляется с apt-get
RUN PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm ci

# Скопировать остальную часть кода приложения
COPY . .

# Собрать приложение Next.js
# Предполагается, что в вашем `package.json` есть скрипт "build"
RUN npm run build

# Для standalone режима нужно скопировать статические файлы
# Standalone сервер ожидает public и .next/static в правильных местах
RUN cp -r public .next/standalone/ 2>/dev/null || true
RUN cp -r .next/static .next/standalone/.next/ 2>/dev/null || true

# Открыть порт, на котором прослушивает ваше приложение Next.js
EXPOSE 3000

# Railway предоставляет PORT переменную окружения
ENV PORT=3000

# Команда для запуска standalone сервера
# Standalone сервер автоматически использует PORT из env
CMD ["node", ".next/standalone/server.js"]
