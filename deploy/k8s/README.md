# EKA BUILD — Kubernetes

Kustomize manifestlari: `base/` (ilova + ma'lumotlar xizmatlari), `components/` (monitoring, KEDA),
`overlays/production/` (production sozlamalari, TLS issuer, image teglari), `jobs/migrate.yaml`, `helm-values/`.

```
                      ┌──────────── ingress-nginx (TLS: cert-manager / Let's Encrypt) ────────────┐
                      │ ekabuild.uz · www · app · admin → web:3000   (/api → api:4000)            │
                      │ api.ekabuild.uz → api:4000                                                 │
                      └───────────────┬───────────────────────────────┬────────────────────────────┘
                     Deployment web (HPA 2–8)              Deployment api (HPA 2–10, PDB)
                                                                       │
              StatefulSet mysql · redis · rabbitmq  ◀──────────────────┤
                                                       Deployment worker (HPA 2–6 yoki KEDA: navbat uzunligi bo'yicha)
   monitoring ns: kube-prometheus-stack (Prometheus, Alertmanager→Telegram, Grafana) · Loki · Alloy (loglar)
```

## Nima "ideal" qilib sozlangan

| | |
|---|---|
| **Zero-downtime** | `RollingUpdate maxUnavailable: 0`, readiness/startup probe'lar, `preStop` 5s (ingress podni olib tashlashga ulguradi), graceful shutdown |
| **Autoscaling** | HPA (CPU 65% / RAM 80%, tez scale-up, sekin scale-down); worker uchun ixtiyoriy **KEDA** — RabbitMQ navbat uzunligi bo'yicha 2→12 |
| **Yuqori mavjudlik** | PodDisruptionBudget (`minAvailable: 1`), `topologySpreadConstraints` — replikalar turli node'larda |
| **Xavfsizlik** | non-root, `readOnlyRootFilesystem`, `capabilities: drop ALL`, seccomp `RuntimeDefault`, NetworkPolicy (default deny → faqat kerakli yo'llar), `/metrics` tashqariga ochilmaydi, Pod Security labels |
| **Monitoring** | ServiceMonitor (api, worker, rabbitmq), PrometheusRule (alertlar), Grafana dashboard ConfigMap (sidecar avtomatik yuklaydi) |
| **Loglar** | Grafana Alloy → Loki; api/worker JSON loglari `level`, `service`, `reqId` bo'yicha qidiriladi |
| **Migratsiya** | Har deploydan oldin `Job migrate` (Prisma migrate deploy + idempotent seed) |

## O'rnatish

```bash
# 0) klaster komponentlari (bir marta)
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo add jetstack https://charts.jetstack.io
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx -n ingress-nginx --create-namespace
helm upgrade --install cert-manager jetstack/cert-manager -n cert-manager --create-namespace --set crds.enabled=true
helm upgrade --install kube-prometheus-stack prometheus-community/kube-prometheus-stack -n monitoring --create-namespace -f deploy/k8s/helm-values/kube-prometheus-stack.yaml
helm upgrade --install loki grafana/loki -n monitoring -f deploy/k8s/helm-values/loki.yaml
helm upgrade --install alloy grafana/alloy -n monitoring -f deploy/k8s/helm-values/alloy.yaml
# (ixtiyoriy) helm upgrade --install keda kedacore/keda -n keda --create-namespace

# 1) sirlar
kubectl create namespace ekabuild
cp deploy/k8s/overlays/production/secret.example.yaml /tmp/secret.yaml && nano /tmp/secret.yaml
kubectl apply -f /tmp/secret.yaml && rm /tmp/secret.yaml        # yoki Sealed Secrets / External Secrets

# 2) deploy (image build + push + migratsiya + rollout)
REGISTRY=ghcr.io/distriforcontry ./deploy/k8s/deploy.sh
```

Tekshirish: `kubectl -n ekabuild get pods,hpa,pdb,ingress` · `kubectl -n ekabuild logs deploy/api -f`.

## Eslatmalar

* **Fayl ombori:** `uploads` PVC `ReadWriteMany` talab qiladi (Longhorn, NFS, CephFS, EFS). RWX bo'lmasa
  `STORAGE_DRIVER=s3` va S3 sozlamalarini kiriting.
* **Ma'lumotlar bazasi:** `base/data/*` — bitta node'li StatefulSet'lar (kichik klaster uchun). Production HA uchun
  boshqariladigan MySQL yoki MySQL Operator, RabbitMQ Cluster Operator (3 node quorum), Redis Sentinel tavsiya
  etiladi — ilova faqat `DATABASE_URL` / `RABBITMQ_URL` / `REDIS_URL` ni biladi.
* **Real-time chat** bir nechta api podda Redis pub/sub orqali ishlaydi — sticky session kerak emas.
* Manifestlar `kustomize build` + Kubernetes 1.33 sxemasiga qarshi tekshirilgan.
