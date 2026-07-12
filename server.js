const http = require("http");
const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");

const otpStore = {};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});
transporter.verify()
  .then(() => {
    console.log("Gmail connection successful.");
  })
  .catch(error => {
    console.log("Gmail connection failed:", error.message);
  });

function getBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", chunk => body += chunk);

    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid request"));
      }
    });
  });
}

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

  if (request.method === "POST" && request.url === "/api/send-otp") {
  getBody(request).then(async user => {
    if (!user.fullName || !user.email || !user.password || !user.department) {
      return sendJson(response, 400, {
        message: "Please complete all fields."
      });
    }

    const database = readDatabase();

    const userExists = database.users.some(item => item.email === user.email);

    if (userExists) {
      return sendJson(response, 409, {
        message: "This email already has an account."
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));

    otpStore[user.email] = {
      otp: otp,
      user: user,
      expiry: Date.now() + 10 * 60 * 1000
    };

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "EcoSphere Email Verification",
      text: `Your EcoSphere OTP is ${otp}. It expires in 10 minutes.`
    });

    sendJson(response, 200, {
      message: "OTP sent to your email."
    });
  }).catch(() => {
    sendJson(response, 400, {
      message: "Invalid data."
    });
  });

  return;
}

if (request.method === "POST" && request.url === "/api/verify-otp") {
  getBody(request).then(data => {
    const savedOtp = otpStore[data.email];

    if (!savedOtp) {
      return sendJson(response, 400, {
        message: "Please request an OTP first."
      });
    }

    if (Date.now() > savedOtp.expiry) {
      delete otpStore[data.email];

      return sendJson(response, 400, {
        message: "OTP has expired. Please request a new one."
      });
    }

    if (savedOtp.otp !== data.otp) {
      return sendJson(response, 400, {
        message: "Incorrect OTP."
      });
    }

    const database = readDatabase();

    database.users.push({
      id: Date.now(),
      fullName: savedOtp.user.fullName,
      email: savedOtp.user.email,
      password: savedOtp.user.password,
      department: savedOtp.user.department,
      role: "Employee",
      xp: 0,
      verified: true
    });

    saveDatabase(database);
    delete otpStore[data.email];

    sendJson(response, 201, {
      message: "Email verified. Account created successfully.",
      fullName: savedOtp.user.fullName
    });
  }).catch(() => {
    sendJson(response, 400, {
      message: "Invalid data."
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