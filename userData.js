require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { Parser } = require('json2csv');

const HEADERS = {
  Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkTEJ3cG5MdE1SVWRCOTVBdWFCWjhMd0hSR2lTUTBpVCJ9.Q7-3SuUgnZXJuu-j2_kw9r8J82ckSxRR6zxylpgVG5o`,
  'x-authenticated-user-token': `eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI5bC1PTmFodUVWbFN3c1RKbFJlQjg3QmxxN21OQjFJSHd0M1pvcl9QRWpVIn0.eyJqdGkiOiJmMjA5MDUzNC02MGIzLTQ5YzEtOWE4YS1hYTU5YzkyNDA4YTUiLCJleHAiOjE3NDc3MjQwMDQsIm5iZiI6MCwiaWF0IjoxNzQ3NjM3NjA0LCJpc3MiOiJodHRwczovL251bHAubml1YS5vcmcvYXV0aC9yZWFsbXMvc3VuYmlyZCIsImF1ZCI6WyJyZWFsbS1tYW5hZ2VtZW50IiwiYWNjb3VudCJdLCJzdWIiOiI3M2VkZjFiNi00Y2QyLTQ1N2MtYTEyMS0xZGRhN2E2MzgyNDgiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJsbXMiLCJhdXRoX3RpbWUiOjAsInNlc3Npb25fc3RhdGUiOiI2YzIwODRiYy01YWVkLTQwYzgtYWZiOC0wYzZmNDA1OTIyN2EiLCJhY3IiOiIxIiwiYWxsb3dlZC1vcmlnaW5zIjpbImh0dHBzOi8vbnVscC5uaXVhLm9yZyJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJhZG1pbiIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsicmVhbG0tbWFuYWdlbWVudCI6eyJyb2xlcyI6WyJtYW5hZ2UtdXNlcnMiXX0sImxtcyI6eyJyb2xlcyI6WyJ1bWFfcHJvdGVjdGlvbiJdfSwiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiIiLCJjbGllbnRJZCI6ImxtcyIsImNsaWVudEhvc3QiOiIxMDMuMTYzLjE2Ny4xNDIiLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJzZXJ2aWNlLWFjY291bnQtbG1zIiwiY2xpZW50QWRkcmVzcyI6IjEwMy4xNjMuMTY3LjE0MiIsImVtYWlsIjoic2VydmljZS1hY2NvdW50LWxtc0BwbGFjZWhvbGRlci5vcmcifQ.c8A5JRjJmj0Q2mfsE7NoKKXg4Rmr0w8juJSYc1-2vYVOSG45Yuz9SQ4BbySzNgJxsOsJtE_ZI8cWjaUF-TCjuk6d6_QFIjFUOfFSZDe3Klkm79kqZHfHBXcy8g-BxBLmUu9c3rWeSeFc5Ni7Bvzux_JMDYr4ep1oeEJNzbQZxTqSjnYuP5Rm3J4TlRAfGfjcjS6-V5Y7rJHOQcbGG_eAJ_LFFSs9HZd97Uk0SfmdrXyU9qoPdY-0puoUa6XDgKY1NJTwZBatSZ9Xq3wb_RS_VRQwZwD_POt9IoNPJhlX3hEtoIEyfHNqzyovqalOL8V4c8vn0O8HBlh_r91vlr2Oxg`,
  'Content-Type': 'application/json',
};

const CUSTOM_HEADERS = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Origin: 'https://nulp.niua.org',
    Referer: 'https://nulp.niua.org/webapp/profile',
    'User-Agent': 'Mozilla/5.0',
    'x-authenticated-user-token': process.env.USER_TOKEN,
  };

console.log('HEADERS', HEADERS);

const API_BASE = 'https://nulp.niua.org';
const LIMIT = 1000;
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function fetchPaginatedUsers() {
  let allUsers = [];
  let offset = 0;
  let total = Infinity;

  while (offset < 10000) {
    console.log(`Fetching users: offset ${offset}`);
    console.log(`Fetching users: total ${total}`);
    const res = await axios.post(`${API_BASE}/api/user/v1/search`, {
      request: {
        filters: {},
        fields: [
          'identifier',
          'userName',
          'firstName',
          'lastName',
          'rootOrgId',
          'roles',
          'organisations.orgName',
          'organisations.roles',
          'framework.board',
          'framework.medium',
          'framework.gradeLevel',
          'maskedEmail',
          'maskedPhone'
        ],
        limit: LIMIT,
        offset,
      },
    }, { headers: HEADERS });

    const { count, content } = res.data.result.response;
    console.log(`Fetched ${content.length} users`);
    total = count;

    allUsers.push(...content);
    offset += LIMIT;

    await delay(500); // prevent throttling
  }

  return allUsers;
}

async function fetchAdditionalUserData(userIds) {
  const res = await axios.post(`${API_BASE}/custom/user/read`, {
    user_ids: userIds,
  }, { headers: CUSTOM_HEADERS });

  const result = res.data.result;
  const map = {};
  for (const entry of result) {
    map[entry.user_id] = entry;
  }
  return map;
}

function sanitize(str) {
  if (!str) return '';
  return String(str).replace(/\s+/g, ' ').trim();
}

(async () => {
  try {
    const users = await fetchPaginatedUsers();
    console.log(`Total users fetched: ${users.length}`);

    const finalData = [];

    for (let i = 0; i < users.length; i += 100) {
      const chunk = users.slice(i, i + 100);
      const userIdMap = await fetchAdditionalUserData(chunk.map(u => u.identifier));

      for (const user of chunk) {
        const extra = userIdMap[user.identifier] || {};

        finalData.push({
          'User_ID': user.identifier,
          'User Name': sanitize(user.userName),
          'Organisation': sanitize(user.rootOrgName || (user.organisations?.[0]?.orgName)),
          'State': sanitize(extra.state),
          'District': sanitize(extra.district),
          'User Type': sanitize(user.organisations?.[0]?.roles?.join(', ') || extra.user_type),
          'Designation': sanitize(extra.designation),
          'Domain': sanitize(user.framework?.board?.join(', ')),
          'Sub-Domain': '', // still not available
          'E-Mail (Masked)': sanitize(user.maskedEmail),
          'Phone Number (Masked)': sanitize(user.maskedPhone),
        });
      }

      console.log(`Processed ${i + chunk.length} users`);
      await delay(500); // avoid rate limits
    }

    const parser = new Parser();
    const csv = parser.parse(finalData);
    fs.writeFileSync('users_data.csv', csv);

    console.log('✅ Data written to users_data.csv');
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
})();
