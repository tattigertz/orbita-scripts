// Проста база даних користувачів прямо в пам'яті (для Netlify Functions)
// У реальному проєкті краще підключити MongoDB/Supabase, але для тесту міняємо тут:
let users = [
  { email: "admin@orbita.com", pass: "admin123", role: "admin", status: "active" }
];

exports.handler = async (event, context) => {
  // Дозволяємо CORS-запити
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const method = event.httpMethod;

  // GET запит: Отримання списку або перевірка статусу
  if (method === "GET") {
    const emailParam = event.queryStringParameters && event.queryStringParameters.email;
    if (emailParam) {
      return { statusCode: 200, headers, body: JSON.stringify({ users }) };
    }
    return { statusCode: 200, headers, body: JSON.stringify({ users }) };
  }

  // POST запит: Логіка авторизації, створення та блокування
  if (method === "POST") {
    try {
      const data = JSON.parse(event.body);
      const { action, email, pass, status } = data;

      // 1. ВХІД (LOGIN)
      if (action === "login") {
        const user = users.find(u => u.email === email && u.pass === pass);
        if (!user) {
          return { statusCode: 401, headers, body: JSON.stringify({ error: "Неправильний логін або пароль" }) };
        }
        if (user.status === "blocked") {
          return { statusCode: 403, headers, body: JSON.stringify({ error: "Ваш акаунт заблоковано!" }) };
        }
        return { statusCode: 200, headers, body: JSON.stringify({ user }) };
      }

      // 2. СТВОРЕННЯ КОРИСТУВАЧА (CREATE)
      if (action === "create") {
        const exists = users.find(u => u.email === email);
        if (exists) {
          return { statusCode: 400, headers, body: JSON.stringify({ error: "Такий користувач вже існує" }) };
        }
        const newUser = { email, pass, role: "manager", status: "active" };
        users.push(newUser);
        return { statusCode: 200, headers, body: JSON.stringify({ success: true, user: newUser }) };
      }

      // 3. ЗМІНА СТАТУСУ / БЛОКУВАННЯ (UPDATE STATUS)
      if (action === "updateStatus") {
        const user = users.find(u => u.email === email);
        if (user) {
          user.status = status;
          return { statusCode: 200, headers, body: JSON.stringify({ success: true, user }) };
        }
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Користувача не знайдено" }) };
      }

      return { statusCode: 400, headers, body: JSON.stringify({ error: "Невідома дія" }) };

    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Помилка сервера: " + err.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: "Метод не підтримується" }) };
};
