# NULP-Script

A Node.js utility script to update outdated URLs (containing `nulpstorage1`) to the correct format (`nulpstorage`) in a Neo4j database. The script processes nodes in batches, logs each step, and ensures traceability of updates using `IL_UNIQUE_ID` and `nodeId`.

---

## 📦 Features

- Scans Neo4j for nodes with URLs containing `nulpstorage1`
- Replaces `nulpstorage1` with `nulpstorage` in relevant properties
- Processes nodes in batches
- Logs:
  - ✅ Successful updates
  - ❌ Errors
  - 📄 General process info

---

## ⚙️ Configuration

Create a `.env` file in the project root with the following variables:

```env
PORT=3000
BATCH_SIZE=10
MAX_UPDATES=100
NEO4J_URL=http://localhost:7474/db/data/transaction/commit
NEO4J_USER=your-neo4j-username
NEO4J_PASSWORD=your-neo4j-password
CREATED_BY=identifier-used-in-nodes
