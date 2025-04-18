require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();

const PORT = process.env.PORT || 3000;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 10;
const MAX_UPDATES = parseInt(process.env.MAX_UPDATES, 10) || 100;
const NEO4J_URL = process.env.NEO4J_URL;
const CREATED_BY = process.env.CREATED_BY;

console.log("NEO4J_URL", NEO4J_URL);
console.log("CREATED_BY", CREATED_BY);
console.log("BATCH_SIZE", BATCH_SIZE);
console.log("MAX_UPDATES", MAX_UPDATES);
console.log("PORT", PORT);
console.log("process.env.NEO4J_USER", process.env.NEO4J_USER)
console.log("process.env.NEO4J_PASSWORD", process.env.NEO4J_PASSWORD)

const auth = Buffer.from(`${process.env.NEO4J_USER}:${process.env.NEO4J_PASSWORD}`).toString("base64");

async function fetchNodesWithNulpstorage1(skip = 0, limit = BATCH_SIZE) {
  // const query = `
  //   MATCH (n)
  //   WHERE (
  //     n.downloadUrl CONTAINS "nulpstorage1" OR
  //     n.posterImage CONTAINS "nulpstorage1" OR
  //     n.streamingUrl CONTAINS "nulpstorage1" OR
  //     n.appIcon CONTAINS "nulpstorage1" OR
  //     n.artifactUrl CONTAINS "nulpstorage1" OR
  //     n.previewUrl CONTAINS "nulpstorage1"
  //   ) AND n.createdBy = "${CREATED_BY}"
  //   RETURN n
  //   SKIP $skip
  //   LIMIT $limit
  // `;

  const query = `
    MATCH (n)
    WHERE 
     n.createdBy = "${CREATED_BY}"
    RETURN n
    SKIP $skip
    LIMIT $limit
  `;

  const response = await axios.post(
    NEO4J_URL,
    {
      statements: [
        {
          statement: query,
          parameters: { skip, limit },
        },
      ],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
    }
  );

  return response.data.results?.[0]?.data || [];
}

async function updateNodeUrls(nodeId, props) {
  const filteredProps = Object.entries(props)
    .filter(([_, value]) => typeof value === "string" && value.includes("nulpstorage1"))
    .reduce((acc, [key, value]) => {
      acc[key] = value.replace(/nulpstorage1/g, "nulpstorage");
      return acc;
    }, {});

  if (Object.keys(filteredProps).length === 0) return;

  const setStatements = Object.keys(filteredProps)
    .map((key) => `n.${key} = $${key}`)
    .join(", ");

  const query = `
    MATCH (n)
    WHERE ID(n) = $nodeId
    SET ${setStatements}
    RETURN n;
  `;

  const params = { nodeId, ...filteredProps };

  const updateRes = await axios.post(
    NEO4J_URL,
    {
      statements: [{ statement: query, parameters: params }],
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
    }
  );

  return updateRes.data;
}

app.get("/api/neo4j/fix-nulpstorage-urls", async (req, res) => {
  let totalUpdated = 0;

  try {
    while (totalUpdated < MAX_UPDATES) {
      const nodes = await fetchNodesWithNulpstorage1(0);
      if (!nodes.length) break;

      for (const item of nodes) {
        if (totalUpdated >= MAX_UPDATES) break;

        const nodeId = item.meta?.[0]?.id;
        const nodeData = item.row?.[0];
        if (nodeId != null && nodeData) {
          await updateNodeUrls(nodeId, nodeData);
          totalUpdated++;
          console.log("Updated nodeId:", nodeId, "- Total updated:", totalUpdated);
        }
      }
    }

    res.json({ success: true, message: `${totalUpdated} nodes updated.` });
  } catch (err) {
    console.error("Error:", err.response?.data || err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/neo4j/content", async (req, res) => {
  const nodes = await fetchNodesWithNulpstorage1();
  return res.json({ success: true, nodes, nodes });
});


app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
