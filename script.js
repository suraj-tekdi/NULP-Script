require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const PORT = process.env.PORT || 3000;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE, 10) || 10;
const MAX_UPDATES = parseInt(process.env.MAX_UPDATES, 10) || 100;
const NEO4J_URL = process.env.NEO4J_URL;
const CREATED_BY = process.env.CREATED_BY;

const LOG_DIR = path.join(__dirname, "logs");
const GENERAL_LOG = path.join(LOG_DIR, "general.log");
const SUCCESS_LOG = path.join(LOG_DIR, "success.log");
const ERROR_LOG = path.join(LOG_DIR, "error.log");

console.log("NEO4J_URL", NEO4J_URL);
console.log("CREATED_BY", CREATED_BY);
console.log("BATCH_SIZE", BATCH_SIZE);
console.log("MAX_UPDATES", MAX_UPDATES);
console.log("PORT", PORT);

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

function log(file, message) {
  fs.appendFileSync(file, `${new Date().toISOString()} - ${message}\n`);
}

async function fetchNodesWithNulpstorage1(skip = 0, limit = BATCH_SIZE) {
//   const query = `
//     MATCH (n)
//     WHERE (
//         n.downloadUrl CONTAINS "nulpstorage1" OR
//         n.posterImage CONTAINS "nulpstorage1" OR
//         n.streamingUrl CONTAINS "nulpstorage1" OR
//         n.appIcon CONTAINS "nulpstorage1" OR
//         n.artifactUrl CONTAINS "nulpstorage1" OR
//         n.previewUrl CONTAINS "nulpstorage1"
//     )
//     AND n.createdBy = "${CREATED_BY}"
//     AND n.status = "Live"
//     RETURN n
//     SKIP $skip
//     LIMIT $limit
//   `;

  const query = `
   MATCH (n)
    WHERE (
        n.downloadUrl CONTAINS "nulpstorage1" OR
        n.posterImage CONTAINS "nulpstorage1" OR
        n.streamingUrl CONTAINS "nulpstorage1" OR
        n.appIcon CONTAINS "nulpstorage1" OR
        n.artifactUrl CONTAINS "nulpstorage1" OR
        n.previewUrl CONTAINS "nulpstorage1"
    )
    AND n.status = "Live"
  `;

  try {
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
        },
      }
    );

    return response.data.results?.[0]?.data || [];
  } catch (err) {
    log(ERROR_LOG, `Failed to fetch nodes: ${err.message}`);
    return [];
  }
}

async function updateNodeUrls(nodeId, props) {
  const IL_UNIQUE_ID = props?.IL_UNIQUE_ID || "UNKNOWN";

  const filteredProps = Object.entries(props)
    .filter(([_, value]) => typeof value === "string" && value.includes("nulpstorage1"))
    .reduce((acc, [key, value]) => {
      acc[key] = value.replace(/nulpstorage1/g, "nulpstorage");
      return acc;
    }, {});

  if (Object.keys(filteredProps).length === 0) {
    log(GENERAL_LOG, `No update needed for nodeId=${nodeId}, IL_UNIQUE_ID=${IL_UNIQUE_ID}`);
    return;
  }

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

  try {
    const updateRes = await axios.post(
      NEO4J_URL,
      {
        statements: [
          {
            statement: query,
            parameters: params,
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    console.log("updateRes", updateRes.data);

    // log(SUCCESS_LOG, `Updated nodeId=${nodeId}, IL_UNIQUE_ID=${IL_UNIQUE_ID}, status=${updateRes.data.results[0].status}, primaryCategory=${updateRes.data.results[0].data[0].row[0].primaryCategory}`);
    log(
        SUCCESS_LOG,
        `Updated nodeId=${nodeId}, IL_UNIQUE_ID=${IL_UNIQUE_ID}, status=${updateRes.data.results[0].data[0].row[0].status}, primaryCategory=${updateRes.data.results[0].data[0].row[0].primaryCategory}`
      );
    return updateRes.data;
  } catch (err) {
    log(ERROR_LOG, `Failed to update nodeId=${nodeId}, IL_UNIQUE_ID=${IL_UNIQUE_ID} - ${err.message}`);
  }
}

(async () => {
  let skip = 0;
  let totalUpdated = 0;

  log(GENERAL_LOG, "Starting nulpstorage1 URL fix script...");

  while (totalUpdated < MAX_UPDATES) {
    const nodes = await fetchNodesWithNulpstorage1(skip);

    if (!nodes.length) {
      log(GENERAL_LOG, "No more nodes to process. Exiting.");
      break;
    }

    for (const item of nodes) {
      if (totalUpdated >= MAX_UPDATES) break;

      const nodeId = item.meta[0].id;
      const nodeData = item.row[0];
      const IL_UNIQUE_ID = nodeData?.IL_UNIQUE_ID || "UNKNOWN";

      log(GENERAL_LOG, `Processing nodeId=${nodeId}, IL_UNIQUE_ID=${IL_UNIQUE_ID}`);
      await updateNodeUrls(nodeId, nodeData);
      totalUpdated++;
      console.log("totalUpdated", totalUpdated);
    }

    skip += BATCH_SIZE;
  }

  log(GENERAL_LOG, `Completed. Total nodes updated: ${totalUpdated}`);
})();
