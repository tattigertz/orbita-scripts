const https = require("https");

const ADMIN_EMAIL = "admin@orbita.com";
const ADMIN_PASS = "orbita2025";
const FB_URL = "orbita-scripts-education-default-rtdb.firebaseio.com";
const FB_SECRET = "e9EK7Ci6Nj2VKIOiWwZAewJXIPAvTnI6gAh5ibMA";

function resp(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function fbRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const url = `https://${FB_URL}${path}.json?auth=${FB_SECRET}`;
    const body = data ? JSON.stringify(data) : null;
    const options = { method, headers: { "Content-Type": "application/json" } };
    const req = https.request(url, options, (res) => {
      let raw = "";
      res.on("data", (c) => (raw += c));
      res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { resolve(null); } });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getUsers() {
  const data = await fbRequest("GET", "/users");
  if (!data) return [];
  return Object.values(data);
}

async function saveUsers(users) {
  const obj = {};
  users.forEach((u, i) => { obj[i] = u; });
  await fbRequest("PUT", "/users", obj);
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return resp(200, {});

  if (event.httpMethod === "POST") {
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch { return resp(400, { error: "Bad JSON" }); }
    const { action, email = "", pass = "", token = "" } = body;
    const e = email.trim().toLowerCase();

    if (action === "login") {
      if (e === ADMIN_EMAIL.toLowerCase() && pass === ADMIN_PASS) {
        return resp(200, { role: "admin", token: "admin-token" });
      }
      const users = await getUsers();
      const found = users.find(u => u.email.toLowerCase() === e && u.pass === pass);
      if (found) return resp(200, { role: "viewer", token: found.token });
      return resp(401, { error: "Невірна пошта або пароль" });
    }

    if (action === "check") {
      if (e === ADMIN_EMAIL.toLowerCase() && token === "admin-token") return resp(200, { valid: true });
      const users = await getUsers();
      const found = users.find(u => u.email.toLowerCase() === e && u.token === token);
      return resp(200, { valid: !!found });
    }

    if (action === "add") {
      if (e !== ADMIN_EMAIL.toLowerCase() || token !== "admin-token") return resp(403, { error: "Немає доступу" });
      const ne = (body.newEmail || "").trim().toLowerCase();
      const np = (body.newPass || "").trim();
      if (!ne || !np) return resp(400, { error: "Заповніть пошту і пароль" });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ne)) return resp(400, { error: "Невірний формат пошти" });
      if (ne === ADMIN_EMAIL.toLowerCase()) return resp(400, { error: "Ця пошта зайнята адміном" });
      const users = await getUsers();
      if (users.find(u => u.email.toLowerCase() === ne)) return resp(400, { error: "Такий користувач вже існує" });
      const newToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
      users.push({ email: ne, pass: np, token: newToken });
      await saveUsers(users);
      return resp(200, { success: true, users: users.map(u => ({ email: u.email })) });
    }

    if (action === "delete") {
      if (e !== ADMIN_EMAIL.toLowerCase() || token !== "admin-token") return resp(403, { error: "Немає доступу" });
      const te = (body.targetEmail || "").trim().toLowerCase();
      const users = await getUsers();
      const filtered = users.filter(u => u.email.toLowerCase() !== te);
      await saveUsers(filtered);
      return resp(200, { success: true, users: filtered.map(u => ({ email: u.email })) });
    }

    return resp(400, { error: "Невідома дія" });
  }

  if (event.httpMethod === "GET") {
    const p = event.queryStringParameters || {};
    if ((p.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase() || p.token !== "admin-token") {
      return resp(403, { error: "Немає доступу" });
    }
    const users = await getUsers();
    return resp(200, { users: users.map(u => ({ email: u.email })) });
  }

  return resp(405, { error: "Method not allowed" });
};
