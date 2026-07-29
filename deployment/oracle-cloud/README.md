# ClassPulse — Oracle Cloud Always Free Deployment Guide

This guide walks you through deploying ClassPulse on Oracle Cloud's **Always Free** ARM Ampere instances — the most powerful free hosting available: **4 OCPUs, 24 GB RAM, 10 TB bandwidth/month**.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Create Oracle Cloud Account](#step-1-create-oracle-cloud-account)
3. [Step 2: Create ARM Instance](#step-2-create-arm-instance)
4. [Step 3: Connect via SSH](#step-3-connect-via-ssh)
5. [Step 4: Run Server Setup](#step-4-run-server-setup)
6. [Step 5: Configure Environment](#step-5-configure-environment)
7. [Step 6: Deploy](#step-6-deploy)
8. [Step 7: Configure DNS (Optional)](#step-7-configure-dns-optional)
9. [Step 8: SSL with Let's Encrypt (Optional)](#step-8-ssl-with-lets-encrypt-optional)
10. [Updating Deployments](#updating-deployments)
11. [Troubleshooting](#troubleshooting)
12. [Capacity & Limits](#capacity--limits)

---

## Prerequisites

- A GitHub account (your repo: `Padrino-221/ClassPulse`)
- Your Neon database URL (already configured on Render)
- A terminal with `ssh` and `scp` access
- (Optional) A domain name for SSL

---

## Step 1: Create Oracle Cloud Account

1. Go to [https://cloud.oracle.com/free](https://cloud.oracle.com/free)
2. Click **Start for Free**
3. Fill in your details — you'll need:
   - Email address
   - Phone number (for verification)
   - Credit card (for identity verification only — **you will NOT be charged** on Always Free)
4. Verify your email and phone number
5. Select your **home region** (choose closest to your users):
   - **UK London** (`uk-london-1`) — good for UK universities
   - **Germany Central** (`eu-frankfurt-1`) — good for Europe
   - **US East** (`us-ashburn-1`) — lowest latency globally

> **Important**: Once you select a home region, you cannot change it. ARM instances are only available in certain regions.

---

## Step 2: Create ARM Instance

1. Log in to [Oracle Cloud Console](https://cloud.oracle.com)
2. Click the **hamburger menu** (☰) → **Compute** → **Instances** → **Create Instance**
3. Fill in:
   - **Name**: `classpulse`
   - **Image**: Select **Canonical Ubuntu 22.04** (or latest Ubuntu)
   - **Shape**: Click **Change shape**
     - Select **Ampere A1** (ARM)
     - **OCPU count**: 4
     - **Memory**: 24 GB
     - This is within Always Free limits
4. **Virtual cloud network**: Create a new VCN
   - Click **Create virtual cloud network**
   - Select **Create VCN with Internet Connectivity**
   - Click **Create**
5. **Subnet**: Use the created subnet
   - **Public IP address**: Select **Assign a public IP address**
6. **SSH keys**: Upload your SSH public key
   - If you don't have one, generate it:
     ```bash
     ssh-keygen -t ed25519 -C "your-email@example.com"
     ```
   - Paste the contents of `~/.ssh/id_ed25519.pub`
7. Click **Create** and wait 2–3 minutes for the instance to launch
8. Note down the **Public IP address** (e.g., `129.153.xx.xx`)

---

## Step 3: Connect via SSH

```bash
ssh -i ~/.ssh/id_ed25519 ubuntu@YOUR_PUBLIC_IP
```

> Replace `YOUR_PUBLIC_IP` with the IP from Step 2.

If connection is refused:
- Wait 1–2 minutes after instance creation
- Check that the instance status is **Running**
- Verify your SSH key matches what you uploaded

---

## Step 4: Run Server Setup

The setup script installs Node.js 20, Nginx, PM2, and configures the firewall.

**Option A — Download and run directly:**

```bash
# Copy the setup script to the instance
scp -i ~/.ssh/id_ed25519 \
  deployment/oracle-cloud/setup.sh \
  ubuntu@YOUR_PUBLIC_IP:/tmp/setup.sh

# SSH in and run it
ssh -i ~/.ssh/id_ed25519 ubuntu@YOUR_PUBLIC_IP
bash /tmp/setup.sh
```

**Option B — Run from within the instance:**

If you've already cloned the repo, run:
```bash
bash /opt/classpulse/deployment/oracle-cloud/setup.sh
```

The script will:
- Update system packages (~2 min)
- Install Node.js 20.x
- Install Nginx
- Install PM2 with auto-start on boot
- Configure UFW firewall

---

## Step 5: Configure Environment

### 5.1 Clone the repository

```bash
cd /opt/classpulse
sudo git clone https://github.com/Padrino-221/ClassPulse.git .
sudo chown -R ubuntu:ubuntu /opt/classpulse
```

### 5.2 Create the backend `.env` file

```bash
cp .env.example backend/.env
nano backend/.env
```

Fill in your values:

```env
# Your Neon database URL (from your existing Render .env)
DATABASE_URL=postgresql://neondb_owner:xxxx@ep-xxx.us-east-2.aws.neon.tech/classpulse?sslmode=require

# Generate a new secret: openssl rand -hex 32
JWT_SECRET=<run: openssl rand -hex 32>

# Server config
PORT=5000
NODE_ENV=production

# Email (from Resend dashboard)
RESEND_API_KEY=re_xxxxx
FROM_EMAIL=ClassPulse <onboarding@resend.dev>

# Frontend URL (your Oracle IP or domain)
FRONTEND_URL=http://YOUR_PUBLIC_IP
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

### 5.3 Create log directory

```bash
sudo mkdir -p /var/log/classpulse
sudo chown ubuntu:ubuntu /var/log/classpulse
```

---

## Step 6: Deploy

Run the deployment script:

```bash
cd /opt/classpulse
bash deployment/oracle-cloud/deploy.sh
```

The script will:
1. Pull latest code from GitHub
2. Install backend dependencies (production only)
3. Build the frontend (Vite)
4. Run database migrations
5. Start the app with PM2 (2 cluster instances)
6. Configure Nginx

### Verify it's running:

```bash
# Check PM2 status
pm2 status

# Check health endpoint
curl http://localhost/api/health

# Check Nginx
curl -I http://localhost/
```

You should see:
- PM2: `classpulse-api` online with 2 instances
- Health: `{"status":"ok"}`
- Nginx: `200 OK`

### Access your app:

Open a browser and go to:
```
http://YOUR_PUBLIC_IP
```

---

## Step 7: Configure DNS (Optional)

If you have a domain (e.g., `classpulse.example.com`):

1. Go to your domain registrar's DNS settings
2. Add an **A record**:
   - **Name**: `classpulse` (or `@` for root)
   - **Value**: Your Oracle Cloud public IP
   - **TTL**: 300

3. Update Nginx to use your domain:

```bash
sudo nano /etc/nginx/sites-available/classpulse
```

Change:
```nginx
server_name _;
```
to:
```nginx
server_name classpulse.example.com;
```

Reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

Update your backend `.env`:
```bash
nano /opt/classpulse/backend/.env
```
Set:
```
FRONTEND_URL=http://classpulse.example.com
```

Redeploy:
```bash
bash /opt/classpulse/deployment/oracle-cloud/deploy.sh
```

---

## Step 8: SSL with Let's Encrypt (Optional)

Once DNS is configured:

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d classpulse.example.com

# Auto-renewal is set up automatically. Verify with:
sudo certbot renew --dry-run
```

After SSL, update `.env`:
```
FRONTEND_URL=https://classpulse.example.com
```

---

## Updating Deployments

Every time you push to GitHub:

```bash
# On your local machine
git push origin master

# SSH into the server
ssh -i ~/.ssh/id_ed25519 ubuntu@YOUR_PUBLIC_IP

# Run deploy script
bash /opt/classpulse/deployment/oracle-cloud/deploy.sh
```

---

## Troubleshooting

### App returns 502 Bad Gateway

```bash
# Check if the backend is running
pm2 status

# If stopped, check logs
pm2 logs classpulse-api --lines 50

# Restart
pm2 restart classpulse-api
```

### Database connection errors

```bash
# Test the connection
cd /opt/classpulse/backend
node -e "const {pool} = require('./config/db'); pool.query('SELECT NOW()').then(r => {console.log(r.rows); process.exit(0)}).catch(e => {console.error(e.message); process.exit(1)})"
```

Common causes:
- Neon database is paused (free tier pauses after inactivity)
- Wrong `DATABASE_URL` in `.env`
- `sslmode=require` missing from connection string

### PM2 won't start

```bash
# Check if port 5000 is already in use
sudo lsof -i :5000

# Kill any stale processes
sudo kill -9 $(sudo lsof -t -i :5000) 2>/dev/null

# Restart
pm2 delete classpulse-api
pm2 start /opt/classpulse/backend/ecosystem.config.js
pm2 save
```

### Nginx errors

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -20 /var/log/nginx/error.log

# Reload
sudo systemctl reload nginx
```

### Out of memory

```bash
# Check memory usage
free -h

# Reduce PM2 instances if needed
nano /opt/classpulse/backend/ecosystem.config.js
# Change instances: 2 → 1

pm2 restart classpulse-api
pm2 save
```

### Can't SSH in

- Ensure your instance is **Running** in Oracle Cloud Console
- Check that the **Public IP** is correct
- Verify you're using the correct SSH key
- Try: `ssh -v -i ~/.ssh/id_ed25519 ubuntu@YOUR_PUBLIC_IP`
- Check **Security Lists** in Oracle Cloud Console → VCN → Security Lists → Ensure port 22 is open

---

## Capacity & Limits

### What you get (Always Free):

| Resource | Allocation |
|----------|-----------|
| OCPUs | 4 ARM cores |
| RAM | 24 GB |
| Storage | 200 GB block |
| Bandwidth | 10 TB/month |
| Cost | **$0 forever** |

### Expected performance:

| Scenario | Capacity |
|----------|---------|
| Simultaneous check-ins | **500+** |
| Concurrent API requests | **1,000+** |
| Database queries/sec | Depends on Neon tier |

### Comparison with Render Free:

| | Render Free | Oracle Cloud Free |
|---|---|---|
| RAM | 512 MB | 24 GB |
| CPU | 0.1 shared | 4 dedicated ARM |
| Concurrent users | ~10–30 | ~500+ |
| Cold starts | Yes (15 min) | Never |
| Sleep after idle | Yes | Never |
| Monthly cost | $0 | $0 |

### Neon Free Tier note:

Your database is still on Neon's free tier, which has a **1 concurrent query** limit. If you hit database bottlenecks, consider:
- Upgrading Neon to their Launch plan ($19/mo) — 100 concurrent connections
- Or installing PostgreSQL directly on the Oracle Cloud instance (same ARM VM can handle it)

To install PostgreSQL on Oracle Cloud:
```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo -u postgres createdb classpulse
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'your_password';"
```
Then update `DATABASE_URL` in `.env` to point to `localhost`.
