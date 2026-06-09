const { getDeployStore } = require("@netlify/blobs");

const ADMIN_EMAIL = "admin@orbita.com";
const ADMIN_PASS = "orbita2025";

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

async function getUsers(store) {
  try {
    const raw = await store.get("users", { type: "text" });
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return resp(200, {});

  const store = getDeployStore({ name: "orbita-users", siteID: context.site?.id });

  if (event.httpMethod === "POST") {
    let body;
    try { body = JSON.parse(event.body || "{}"); } catch { return resp(400, { error: "Bad JSON" }); }

    const { action, email = "", pass = "", token = "" } = body;
    const e = email.trim().toLowerCase();

    // LOGIN
    if (action === "login") {
      if (e === ADMIN_EMAIL.toLowerCase() && pass === ADMIN_PASS) {
        return resp(200, { role: "admin", token: "admin-token" });
      }
      const users = await getUsers(store);
      const found = users.find(u => u.email.toLowerCase() === e && u.pass === pass);
      if (found) return resp(200, { role: "viewer", token: found.token });
      return resp(401, { error: "Невірна пошта або пароль" });
    }

    // CHECK TOKEN
    if (action === "check") {
      if (e === ADMIN_EMAIL.toLowerCase() && token === "admin-token") return resp(200, { valid: true });
      const users = await getUsers(store);
      const found = users.find(u => u.email.toLowerCase() === e && u.token === token);
      return resp(200, { valid: !!found });
    }

    // ADD USER
    if (action === "add") {
      if (e !== ADMIN_EMAIL.toLowerCase() || token !== "admin-token") return resp(403, { error: "Немає доступу" });
      const ne = (body.newEmail || "").trim().toLowerCase();
      const np = (body.newPass || "").trim();
      if (!ne || !np) return resp(400, { error: "Заповніть пошту і пароль" });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ne)) return resp(400, { error: "Невірний формат пошти" });
      if (ne === ADMIN_EMAIL.toLowerCase()) return resp(400, { error: "Ця пошта зайнята адміном" });
      const users = await getUsers(store);
      if (users.find(u => u.email.toLowerCase() === ne)) return resp(400, { error: "Такий користувач вже існує" });
      const newToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
      users.push({ email: ne, pass: np, token: newToken });
      await store.set("users", JSON.stringify(users));
      return resp(200, { success: true, users: users.map(u => ({ email: u.email })) });
    }

    // DELETE USER
    if (action === "delete") {
      if (e !== ADMIN_EMAIL.toLowerCase() || token !== "admin-token") return resp(403, { error: "Немає доступу" });
      const te = (body.targetEmail || "").trim().toLowerCase();
      const users = await getUsers(store);
      const filtered = users.filter(u => u.email.toLowerCase() !== te);
      await store.set("users", JSON.stringify(filtered));
      return resp(200, { success: true, users: filtered.map(u => ({ email: u.email })) });
    }

    return resp(400, { error: "Невідома дія" });
  }

  // GET LIST
  if (event.httpMethod === "GET") {
    const p = event.queryStringParameters || {};
    if ((p.email || "").toLowerCase() !== ADMIN_EMAIL.toLowerCase() || p.token !== "admin-token") {
      return resp(403, { error: "Немає доступу" });
    }
    const users = await getUsers(store);
    return resp(200, { users: users.map(u => ({ email: u.email })) });
  }

  return resp(405, { error: "Method not allowed" });
};
