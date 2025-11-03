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
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === CONFIG ===
const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const NOVA_POSHTA_API = "https://api.novaposhta.ua/v2.0/json/";
const PORT = process.env.PORT || 4000;

if (!TOKEN || !CHAT_ID) {
  console.error("❌ BOT_TOKEN або CHAT_ID не знайдено в змінних середовища.");
}

// === TEST ROUTE ===
app.get("/", (req, res) => {
  res.send("Relax Time API running");
});

// === Nova Poshta Proxy ===
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
    console.error("❌ NovaPoshta proxy error:", err);
    res.status(500).json({ error: "Proxy error" });
  }
});

// === Send Order to Telegram ===
app.post("/api/sendOrder", upload.single("photo"), async (req, res) => {
  try {
    const { city, warehouse, name, phone } = req.body;
    const photo = req.file;

    if (!city || !warehouse || !name || !phone) {
      return res.status(400).json({ error: "Всі поля обовʼязкові." });
    }

    const caption = `🛍 <b>Нове замовлення</b>\n\n🏙 Місто: ${city}\n🏤 Відділення: ${warehouse}\n👤 Імʼя: ${name}\n📞 Телефон: ${phone}`;

    // Если есть фото — отправляем фото
    if (photo) {
      const form = new FormData();
      form.append("chat_id", CHAT_ID);
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
      form.append("photo", fs.createReadStream(photo.path));

      const tgRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
        method: "POST",
        body: form,
      });
      const tgData = await tgRes.json();
      fs.unlinkSync(photo.path); // удаляем временный файл

      if (!tgData.ok) throw new Error(tgData.description);
    } else {
      // если фото нет — просто текст
      await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text: caption,
          parse_mode: "HTML",
        }),
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Помилка при відправці замовлення:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`🚀 Server listening on ${PORT}`);
});
