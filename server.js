// === Imports ===
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

// --- CORS (разрешим твой домен и вообще всех, чтобы не мучиться) ---
app.use(cors({ origin: "*", methods: ["GET","POST"], allowedHeaders: ["Content-Type"] }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// === CONFIG ===
const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const NOVA_POSHTA_API = "https://api.novaposhta.ua/v2.0/json/";
const PORT = process.env.PORT || 4000;

// === healthcheck ===
app.get("/", (req, res) => res.send("Relax Time API running"));

// ------- Общая прокси-функция к Новой поште -------
async function proxyNovaPoshta(req, res) {
  try {
    const r = await fetch(NOVA_POSHTA_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body || {})
    });
    // иногда НП отвечает 200/400, нам важно вернуть тело как есть
    const data = await r.json().catch(() => ({}));
    res.status(r.status || 200).json(data);
  } catch (e) {
    console.error("NovaPoshta proxy error:", e);
    res.status(500).json({ error: "Failed to connect Nova Poshta API" });
  }
}

// --- Новый маршрут (как у тебя): /api/novaposhta ---
app.post("/api/novaposhta", proxyNovaPoshta);

// --- СОВМЕСТИМОСТЬ: старые маршруты, на которые бьется фронт ---
app.post("/api/getCities", (req, res) => {
  // клиент шлёт: { apiKey, modelName:"Address", calledMethod:"getCities" }
  proxyNovaPoshta(req, res);
});

app.post("/api/getWarehouses", (req, res) => {
  // клиент шлёт: { apiKey, modelName:"AddressGeneral", calledMethod:"getWarehouses", methodProperties:{ CityRef } }
  proxyNovaPoshta(req, res);
});

// === Отправка заказа в Telegram ===
app.post("/api/sendOrder", upload.single("photo"), async (req, res) => {
  try {
    const { city, warehouse, name, phone } = req.body;
    const photo = req.file;

    if (!city || !warehouse || !name || !phone) {
      return res.status(400).json({ ok: false, error: "Всі поля обовʼязкові." });
    }

    const caption =
      `🛍 <b>Нове замовлення</b>\n\n` +
      `🏙 Місто: ${city}\n` +
      `🏤 Відділення: ${warehouse}\n` +
      `👤 Імʼя: ${name}\n` +
      `📞 Телефон: ${phone}`;

    if (photo) {
      const form = new FormData();
      form.append("chat_id", CHAT_ID);
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
      form.append("photo", fs.createReadStream(photo.path));

      const tgRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
        method: "POST",
        body: form
      });
      const tgData = await tgRes.json();
      // чистим временный файл
      try { fs.unlinkSync(photo.path); } catch {}

      if (!tgData.ok) throw new Error(tgData.description || "Telegram sendPhoto failed");
    } else {
      const tgRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text: caption, parse_mode: "HTML" })
      });
      const tgData = await tgRes.json();
      if (!tgData.ok) throw new Error(tgData.description || "Telegram sendMessage failed");
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Помилка при відправці замовлення:", err);
    res.status(500).json({ ok: false, error: err.message || "Send order failed" });
  }
});

// === Start ===
app.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));
