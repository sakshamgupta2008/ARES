const http = require("http");
const fs = require("fs");
const path = require("path");

const port = 3000;
const databaseFile = path.join(__dirname, "data.json");

function readDatabase() {
  return JSON.parse(fs.readFileSync(databaseFile, "utf8"));
}

function saveDatabase(data) {
  fs.writeFileSync(databaseFile, JSON.stringify(data, null, 2));
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json"
  });

  response.end(JSON.stringify(data));
}

const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/") {
    const html = fs.readFileSync(path.join(__dirname, "index.html"));
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(html);
    return;
  }

  if (request.method === "GET" && request.url === "/api/data") {
    sendJson(response, 200, readDatabase());
    return;
  }

  if (request.method === "POST" && request.url === "/api/signup") {
    let body = "";

    request.on("data", chunk => {
      body += chunk;
    });

    request.on("end", () => {
      const user = JSON.parse(body);

      if (!user.fullName || !user.email || !user.password || !user.department) {
        sendJson(response, 400, {
          message: "Please fill all fields."
        });
        return;
      }

      const database = readDatabase();

      const exists = database.users.some(existingUser => {
        return existingUser.email === user.email;
      });

      if (exists) {
        sendJson(response, 409, {
          message: "This email is already registered."
        });
        return;
      }

      database.users.push({
        id: Date.now(),
        fullName: user.fullName,
        email: user.email,
        password: user.password,
        department: user.department,
        role: "Employee",
        xp: 0
      });

      saveDatabase(database);

      sendJson(response, 201, {
        message: "Account created successfully."
      });
    });

    return;
  }

  sendJson(response, 404, {
    message: "Page not found"
  });
});

server.listen(port, () => {
  console.log(`EcoSphere is running on http://localhost:${port}`);
});