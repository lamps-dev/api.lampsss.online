require("dotenv").config();
const express = require("express");
const serverless = require("serverless-http");
const admin = require("firebase-admin");
const WebSocket = require("ws");
const fs = require("fs");

// ✅ Ensure firebase_admin.json is created at runtime
if (!fs.existsSync("firebase_admin.json")) {
    console.log("Creating firebase_admin.json from environment variable...");
    const firebaseAdminJsonBase64 = process.env.FIREBASE_ADMIN_JSON;
    if (!firebaseAdminJsonBase64) {
        console.error("FIREBASE_ADMIN_JSON environment variable is missing!");
        process.exit(1);
    }
    const firebaseAdminJson = Buffer.from(firebaseAdminJsonBase64, "base64").toString("utf-8");
    fs.writeFileSync("firebase_admin.json", firebaseAdminJson);
}

// ✅ Initialize Firebase
admin.initializeApp({
    credential: admin.credential.cert(require("./firebase_admin.json"))
});
console.log("🔥 Firebase initialized successfully!");

const db = admin.firestore();
const app = express();

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

// ✅ Netlify Serverless Setup (DO NOT USE app.listen)
module.exports.handler = serverless(app);
