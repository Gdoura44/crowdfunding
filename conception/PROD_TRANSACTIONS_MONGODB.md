# Transactions MongoDB (mode “prod-like”) — Note PFE

## Pourquoi ce document ?
En local (PFE), on utilise souvent MongoDB en **standalone**. En production, on utilise généralement MongoDB en **replica set** (même à 1 nœud).  
La différence importante pour notre plateforme n’est pas “fonctionnelle” (les écrans restent identiques), mais concerne la **cohérence des écritures** lors d’actions critiques (paiement, annulation, remboursement, payout).

## Standalone vs Replica set (explication simple)

### MongoDB standalone
- 1 seul serveur MongoDB “simple”.
- **Ne supporte pas** les transactions multi-documents.
- Avantage: facile à installer et suffisant pour le développement.
- Conséquence: si le code essaie de démarrer une transaction, Mongo renvoie typiquement:
  - “Transaction numbers are only allowed on a replica set member or mongos”

### MongoDB replica set
- Mode “production-like” (réplication, élection, journalisation).
- **Supporte** les transactions multi-documents.
- Avantage: permet de garantir “tout ou rien” sur plusieurs écritures liées (ex: Investment + Transaction + AuditLog + Notification).

## Est-ce nécessaire pour le PFE ?
- **Non obligatoire** pour faire fonctionner la plateforme en démo.
- **Bon point PFE**: montrer que tu as prévu un mode “prod-like” et que le code est prêt à être durci en production.
- Pour éviter la complexité, la plateforme garde ce mode **désactivé par défaut**.

## Ce qu’on a implémenté dans le code

### 1) Flag `.env`
Dans `backend/.env`:

- `ENABLE_DB_TRANSACTIONS=false` (par défaut)

Règle:
- Si `ENABLE_DB_TRANSACTIONS` **n’est pas** `true` → exécution **sans transaction** (mode PFE/dev).
- Si `ENABLE_DB_TRANSACTIONS=true` **et** MongoDB supporte les transactions → exécution **avec transaction**.

### 2) Helper `withOptionalTransaction`
Fichier: `backend/utils/withOptionalTransaction.js`

Comportement:
- appelle `work(session)` dans une transaction si possible
- sinon appelle `work(null)` (fallback “sans transaction”)

### 3) Services refactorés
Fichier: `backend/services/investmentService.js`

Actions concernées:
- annulation d’investissement (mise en état + opérations liées)
- relance de paiement (nouvelle tentative + transaction associée)

Objectif:
- éviter des transactions “dures” qui cassent en standalone
- rendre le code prêt pour replica set

## Important: le paiement reste en “mode simulé”
Le fait d’activer les transactions DB ne change pas le fait que le **provider de paiement est mocké**.  
Ça rend seulement les écritures DB plus atomiques/cohérentes.

## Checklist production (si tu déploies vraiment)

### A) MongoDB
- Utiliser un **replica set** (même single-node) pour supporter les transactions.
- Activer `ENABLE_DB_TRANSACTIONS=true`.

### B) Secrets / sécurité
- Définir des secrets longs et uniques:
  - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
  - `INTERNAL_API_SECRET`
  - `BANK_DETAILS_ENC_KEY`
- Ne jamais commiter de mots de passe/SMTP/keys réels.

### C) Redis / BullMQ
- Mettre un vrai `REDIS_URL` disponible (pas en localhost) si tu veux les queues réelles.

### D) Emails
- SMTP dédié (ou provider) + politique email (actions critiques).

## Conseils “jury PFE”
Tu peux expliquer en 2 phrases:
- “En dev, MongoDB standalone ne supporte pas les transactions, donc on utilise un fallback fiable.”
- “En prod, on active un flag et on passe en replica set pour garantir l’atomicité sur les opérations critiques.”

