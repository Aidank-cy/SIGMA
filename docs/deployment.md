# SIGMA Deployment

SIGMA is designed for a local Mac Docker deployment exposed through Cloudflare Tunnel.
Application data lives under `~/sigma-data/`.

## Mac Preparation

1. Install Docker Desktop and enable "Start Docker Desktop when you sign in".
2. Create the data folders:

   ```bash
   mkdir -p ~/sigma-data/postgres ~/sigma-data/redis ~/sigma-data/backups
   ```

3. Prevent the Mac from sleeping while it is serving SIGMA:

   ```bash
   sudo pmset -a sleep 0
   sudo pmset -a disksleep 0
   sudo pmset -a powernap 1
   ```

4. Copy production environment values:

   ```bash
   cp .env.example .env.prod
   ```

5. Edit `.env.prod` and set real API keys plus a unique `JWT_SECRET_KEY` of at least 32 characters.

## Start Production

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

The frontend runs on `http://localhost:3000`; the backend API and OpenAPI docs run on
`http://localhost:8000/api/v1/health` and `http://localhost:8000/docs`.

## Cloudflare Tunnel

1. Install `cloudflared`:

   ```bash
   brew install cloudflare/cloudflare/cloudflared
   ```

2. Authenticate:

   ```bash
   cloudflared tunnel login
   ```

3. Create a tunnel:

   ```bash
   cloudflared tunnel create sigma
   ```

4. Create `~/.cloudflared/config.yml`:

   ```yaml
   tunnel: sigma
   credentials-file: /Users/<you>/.cloudflared/<tunnel-id>.json

   ingress:
     - hostname: sigma.example.com
       service: http://localhost:3000
     - hostname: sigma-api.example.com
       service: http://localhost:8000
     - service: http_status:404
   ```

5. Add DNS routes:

   ```bash
   cloudflared tunnel route dns sigma sigma.example.com
   cloudflared tunnel route dns sigma sigma-api.example.com
   ```

6. Install and start the launchd service:

   ```bash
   sudo cloudflared service install
   sudo launchctl start com.cloudflare.cloudflared
   ```

7. Update `.env.prod`:

   ```bash
   FRONTEND_URL=https://sigma.example.com
   BACKEND_URL=https://sigma-api.example.com
   NEXT_PUBLIC_BACKEND_URL=https://sigma-api.example.com
   ```

8. Restart:

   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

## Operations

- View logs: `docker compose -f docker-compose.prod.yml logs -f sigma-backend`
- Restart app only: `docker compose -f docker-compose.prod.yml restart sigma-backend sigma-frontend`
- Stop stack: `docker compose -f docker-compose.prod.yml down`
- Upgrade after pulling code: `docker compose -f docker-compose.prod.yml up -d --build`
