import express from "express";
import multer from "multer";
import fetch from "node-fetch";
import dotenv from "dotenv";
import cors from "cors";
import FormData from "form-data";
import fs from "fs";

dotenv.config();
const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors({ origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const NOVA_POSHTA_API = "https://api.novaposhta.ua/v2.0/json/";
const PORT = process.env.PORT || 4000;

// === Тест
app.get("/", (req, res) => res.send("Relax Time API running ✅"));

// === Прокси к Новой поште
app.post("/api/novaposhta", async (req, res) => {
  try {
    const response = await fetch(NOVA_POSHTA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("NovaPoshta error:", err);
    res.status(500).json({ error: "Failed to connect Nova Poshta API" });
  }
});

// Старые пути для совместимости
app.post("/api/getCities", async (req, res) => {
  const body = {
    apiKey: process.env.NOVA_POSHTA_KEY,
    modelName: "Address",
    calledMethod: "getCities",
  };
  try {
    const r = await fetch(NOVA_POSHTA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: "getCities failed" });
  }
});

app.post("/api/getWarehouses", async (req, res) => {
  const { CityRef } = req.body;
  const body = {
    apiKey: process.env.NOVA_POSHTA_KEY,
    modelName: "AddressGeneral",
    calledMethod: "getWarehouses",
    methodProperties: { CityRef },
  };
  try {
    const r = await fetch(NOVA_POSHTA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json();
    res.json(d);
  } catch (e) {
    res.status(500).json({ error: "getWarehouses failed" });
  }
});

// === Telegram
app.post("/api/sendOrder", upload.single("photo"), async (req, res) => {
  try {
    const { city, warehouse, name, phone } = req.body;
    const photo = req.file;
    const caption = `🛍 <b>Нове замовлення</b>\n\n🏙 Місто: ${city}\n🏤 Відділення: ${warehouse}\n👤 Імʼя: ${name}\n📞 Телефон: ${phone}`;
    if (photo) {
      const form = new FormData();
      form.append("chat_id", CHAT_ID);
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
      form.append("photo", fs.createReadStream(photo.path));
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, { method: "POST", body: form });
      fs.unlinkSync(photo.path);
    } else {
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text: caption, parse_mode: "HTML" }),
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("Telegram error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
