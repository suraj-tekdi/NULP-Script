require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const NEO4J_URL = process.env.NEO4J_URL;
const LOG_DIR = path.join(__dirname, "logs");
const GENERAL_LOG = path.join(LOG_DIR, "general.log");
const SUCCESS_LOG = path.join(LOG_DIR, "success.log");
const ERROR_LOG = path.join(LOG_DIR, "error.log");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

function log(file, message) {
  fs.appendFileSync(file, `${new Date().toISOString()} - ${message}\n`);
}

// Replace with your specific IL_UNIQUE_IDs
const TARGET_IL_UNIQUE_IDS = [
  "do_1141488391780270081432",
  "do_1141488303242199041427",
  "do_1141488343055974401429",
  "do_1141488366149632001430",
  "do_1141488375954063361431"
];

async function fetchNodesByILIDs() {
  const query = `
    MATCH (n)
    WHERE n.IL_UNIQUE_ID IN $ids
    AND (
        n.downloadUrl CONTAINS "nulpstorage1" OR
        n.posterImage CONTAINS "nulpstorage1" OR
        n.streamingUrl CONTAINS "nulpstorage1" OR
        n.appIcon CONTAINS "nulpstorage1" OR
        n.artifactUrl CONTAINS "nulpstorage1" OR
        n.previewUrl CONTAINS "nulpstorage1"
    )
    RETURN n
  `;

  try {
    const response = await axios.post(
      NEO4J_URL,
      {
        statements: [
          {
            statement: query,
            parameters: { ids: TARGET_IL_UNIQUE_IDS },
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
    log(ERROR_LOG, `Failed to fetch nodes by IL_UNIQUE_IDs: ${err.message}`);
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

    const updatedNode = updateRes.data.results[0].data[0].row[0];
    log(SUCCESS_LOG, `Updated nodeId=${nodeId}, IL_UNIQUE_ID=${IL_UNIQUE_ID}, data=${JSON.stringify(updatedNode)}`);
  } catch (err) {
    log(ERROR_LOG, `Failed to update nodeId=${nodeId}, IL_UNIQUE_ID=${IL_UNIQUE_ID} - ${err.message}`);
  }
}

(async () => {
  log(GENERAL_LOG, "Starting selective nulpstorage1 URL fix...");

  const nodes = await fetchNodesByILIDs();
  if (!nodes.length) {
    log(GENERAL_LOG, "No matching nodes found. Exiting.");
    return;
  }

  for (const item of nodes) {
    const nodeId = item.meta[0].id;
    const nodeData = item.row[0];
    const IL_UNIQUE_ID = nodeData?.IL_UNIQUE_ID || "UNKNOWN";

    log(GENERAL_LOG, `Processing nodeId=${nodeId}, IL_UNIQUE_ID=${IL_UNIQUE_ID}`);
    await updateNodeUrls(nodeId, nodeData);
  }

  log(GENERAL_LOG, `Script completed for ${nodes.length} nodes.`);
})();
