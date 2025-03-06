require("dotenv").config();
const express = require("express");
const serverless = require("serverless-http");
const admin = require("firebase-admin");
const WebSocket = require("ws");
const fs = require("fs");

// Check if the file exists before loading
if (fs.existsSync("firebase_admin.json")) {
    admin.initializeApp({
        credential: admin.credential.cert(require("./firebase_admin.json"))
    });
} else {
    console.error("firebase_admin.json is missing!");
}

const db = admin.firestore();
const app = express();
const PORT = 3001;

app.use(express.json());

// ✅ OAuth Authentication
app.post("/auth", async (req, res) => {
  const { token } = req.body;
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    res.json({ success: true, uid: decodedToken.uid });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
  }
});

// ✅ Get Notifications from Firestore
app.get("/pack/notifs/submission-checker", async (req, res) => {
  try {
    const snapshot = await db.collection("notifications").get();
    const notifications = snapshot.docs.map(doc => doc.data());
    res.json({ notifications });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✅ Real-time WebSocket Notifications
const wss = new WebSocket.Server({ noServer: true });

wss.on("connection", ws => {
  console.log("New client connected");

  db.collection("notifications").onSnapshot(snapshot => {
    const notifications = snapshot.docs.map(doc => doc.data());
    ws.send(JSON.stringify({ notifications }));
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

const server = app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, ws => {
    wss.emit("connection", ws, request);
  });
});

module.exports.handler = serverless(app);
