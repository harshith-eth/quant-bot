# 🚀 PRODUCTION DEPLOYMENT GUIDE

## Overview
This guide covers deploying the Quantum Degen Trading AI Swarm in production environments with high availability, scalability, and security considerations.

## 🏗️ Infrastructure Requirements

### Minimum Production Specs
- **CPU**: 8 cores (Intel Xeon or AMD EPYC)
- **RAM**: 32GB DDR4
- **Storage**: 500GB NVMe SSD
- **Network**: 1Gbps dedicated bandwidth
- **OS**: Ubuntu 20.04 LTS or CentOS 8

### Recommended Production Specs
- **CPU**: 16 cores (Intel Xeon or AMD EPYC)
- **RAM**: 64GB DDR4
- **Storage**: 1TB NVMe SSD + 2TB HDD for logs
- **Network**: 10Gbps dedicated bandwidth
- **OS**: Ubuntu 22.04 LTS

### Cloud Provider Recommendations
- **AWS**: c5.4xlarge or c5.8xlarge instances
- **Google Cloud**: c2-standard-16 or c2-standard-30
- **Azure**: F16s_v2 or F32s_v2
- **DigitalOcean**: CPU-Optimized 16GB or 32GB

## 🐳 Docker Deployment

### Dockerfile Configuration
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend/ .
COPY prompts/ ./prompts/
COPY architecture-docs/ ./docs/

# Create non-root user
RUN useradd -m -u 1000 trader && chown -R trader:trader /app
USER trader

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start application
CMD ["python", "main.py", "--production"]
```

### Docker Compose Configuration
```yaml
version: '3.8'

services:
  trading-bot:
    build: .
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/trading_db
      - REDIS_URL=redis://redis:6379
      - LOG_LEVEL=INFO
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 8G
          cpus: '4'
        reservations:
          memory: 4G
          cpus: '2'

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=trading_db
      - POSTGRES_USER=trader
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ../frontend:/usr/share/nginx/html
    depends_on:
      - trading-bot
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## ☸️ Kubernetes Deployment

### Namespace Configuration
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: trading-system
```

### ConfigMap for Environment Variables
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: trading-config
  namespace: trading-system
data:
  DATABASE_URL: "postgresql://trader:password@postgres:5432/trading_db"
  REDIS_URL: "redis://redis:6379"
  LOG_LEVEL: "INFO"
  MAX_PORTFOLIO_RISK: "0.15"
  WEBSOCKET_PORT: "8000"
```

### Secret for API Keys
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: trading-secrets
  namespace: trading-system
type: Opaque
data:
  OPENAI_API_KEY: <base64-encoded-key>
  ANTHROPIC_API_KEY: <base64-encoded-key>
  BINANCE_API_KEY: <base64-encoded-key>
  BINANCE_SECRET_KEY: <base64-encoded-key>
```

### Deployment Configuration
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: trading-bot
  namespace: trading-system
spec:
  replicas: 3
  selector:
    matchLabels:
      app: trading-bot
  template:
    metadata:
      labels:
        app: trading-bot
    spec:
      containers:
      - name: trading-bot
        image: trading-bot:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: trading-config
        - secretRef:
            name: trading-secrets
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 🔒 Security Configuration

### SSL/TLS Setup
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    location / {
        root /usr/share/nginx/html;
        index index.html;
    }

    location /api/ {
        proxy_pass http://trading-bot:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://trading-bot:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Firewall Configuration
```bash
# UFW Configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# iptables rules for additional security
iptables -A INPUT -p tcp --dport 8000 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 8000 -j DROP
```

## 📊 Monitoring & Observability

### Prometheus Configuration
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'trading-bot'
    static_configs:
      - targets: ['trading-bot:8000']
    metrics_path: '/metrics'
    scrape_interval: 5s
```

### Grafana Dashboard
```json
{
  "dashboard": {
    "title": "Trading Bot Metrics",
    "panels": [
      {
        "title": "Portfolio Value",
        "type": "stat",
        "targets": [
          {
            "expr": "portfolio_total_value",
            "legendFormat": "Total Value"
          }
        ]
      },
      {
        "title": "Active Positions",
        "type": "table",
        "targets": [
          {
            "expr": "active_positions_count",
            "legendFormat": "Positions"
          }
        ]
      }
    ]
  }
}
```

### Log Aggregation (ELK Stack)
```yaml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow
```yaml
name: Deploy Trading Bot

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Set up Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    - name: Install dependencies
      run: |
        cd backend
        pip install -r requirements.txt
    - name: Run tests
      run: |
        cd backend
        python -m pytest tests/

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - name: Build Docker image
      run: |
        docker build -t trading-bot:${{ github.sha }} .
        docker tag trading-bot:${{ github.sha }} trading-bot:latest
    - name: Push to registry
      run: |
        echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
        docker push trading-bot:${{ github.sha }}
        docker push trading-bot:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
    - name: Deploy to production
      run: |
        kubectl set image deployment/trading-bot trading-bot=trading-bot:${{ github.sha }}
        kubectl rollout status deployment/trading-bot
```

## 🚨 Disaster Recovery

### Backup Strategy
```bash
#!/bin/bash
# Daily backup script

# Database backup
pg_dump $DATABASE_URL > /backups/db_$(date +%Y%m%d).sql

# Configuration backup
tar -czf /backups/config_$(date +%Y%m%d).tar.gz /app/config/

# Upload to S3
aws s3 sync /backups/ s3://trading-bot-backups/

# Cleanup old backups (keep 30 days)
find /backups/ -name "*.sql" -mtime +30 -delete
find /backups/ -name "*.tar.gz" -mtime +30 -delete
```

### Recovery Procedures
```bash
# Database recovery
psql $DATABASE_URL < /backups/db_20241215.sql

# Configuration recovery
tar -xzf /backups/config_20241215.tar.gz -C /

# Application restart
kubectl rollout restart deployment/trading-bot
```

## 📈 Performance Optimization

### Database Optimization
```sql
-- Index optimization
CREATE INDEX CONCURRENTLY idx_trades_timestamp ON trades(timestamp);
CREATE INDEX CONCURRENTLY idx_positions_symbol ON positions(token_symbol);
CREATE INDEX CONCURRENTLY idx_whale_activity_wallet ON whale_activity(wallet_address);

-- Connection pooling
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '8GB';
ALTER SYSTEM SET effective_cache_size = '24GB';
```

### Application Optimization
```python
# Redis caching configuration
REDIS_CONFIG = {
    'host': 'redis',
    'port': 6379,
    'db': 0,
    'max_connections': 100,
    'socket_keepalive': True,
    'socket_keepalive_options': {},
    'connection_pool_kwargs': {
        'max_connections': 50,
        'retry_on_timeout': True
    }
}

# WebSocket optimization
WEBSOCKET_CONFIG = {
    'ping_interval': 20,
    'ping_timeout': 10,
    'close_timeout': 10,
    'max_size': 2**20,  # 1MB
    'max_queue': 32,
    'compression': 'deflate'
}
```

## 🔧 Maintenance Procedures

### Regular Maintenance Tasks
```bash
# Weekly maintenance script
#!/bin/bash

# Update system packages
apt update && apt upgrade -y

# Clean Docker images
docker system prune -f

# Rotate logs
logrotate /etc/logrotate.d/trading-bot

# Database maintenance
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Restart services if needed
docker-compose restart trading-bot
```

### Health Monitoring
```bash
# Health check script
#!/bin/bash

# Check API health
if ! curl -f http://localhost:8000/health; then
    echo "API health check failed"
    # Send alert
    curl -X POST $SLACK_WEBHOOK -d '{"text":"Trading bot API is down!"}'
fi

# Check database connection
if ! pg_isready -h postgres -p 5432; then
    echo "Database connection failed"
    # Send alert
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
if (( $(echo "$MEMORY_USAGE > 90" | bc -l) )); then
    echo "High memory usage: $MEMORY_USAGE%"
    # Send alert
fi
```

## 📞 Support & Troubleshooting

### Common Issues
1. **High Memory Usage**: Scale horizontally or increase instance size
2. **Database Locks**: Optimize queries and add proper indexing
3. **API Rate Limits**: Implement exponential backoff and caching
4. **WebSocket Disconnections**: Add reconnection logic and heartbeat

### Emergency Contacts
- **System Admin**: admin@trading-system.com
- **DevOps Team**: devops@trading-system.com
- **On-call Engineer**: +1-555-TRADING

### Escalation Procedures
1. **Level 1**: Automated alerts and self-healing
2. **Level 2**: On-call engineer notification
3. **Level 3**: Full team escalation
4. **Level 4**: Emergency shutdown procedures

---

**Last Updated**: December 15, 2024  
**Version**: 2.1.0  
**Maintainer**: DevOps Team 