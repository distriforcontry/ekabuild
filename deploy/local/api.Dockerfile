# Offline/CI variant: packages artefacts built on the host (pnpm install + tsup) instead of installing in Docker.
# Used only for local stack tests in restricted networks; production uses apps/api/Dockerfile.
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY node_modules ./node_modules
COPY packages ./packages
COPY apps/api/node_modules ./apps/api/node_modules
COPY apps/api/dist ./apps/api/dist
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/package.json ./apps/api/
WORKDIR /app/apps/api
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
