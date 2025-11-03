import express from "express";
import cors from "cors";
import multer from "multer";
import fetch from "node-fetch";
import FormData from "form-data";

const app = express();
const upload = multer();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => res.send("Relax Time API running"));

const TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

app.post("/api/sendOrder", upload.single("photo"), async (req, res) => {
  try {
    const { city, warehouse, name, phone } = req.body;
    const photo = req.file;

    if (!city || !warehouse || !name || !phone) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const text = `
🛍️ <b>Нове замовлення</b>
🏙️ Місто: ${city}
🏤 Відділення: ${warehouse}
👤 Ім’я: ${name}
📞 Телефон: ${phone}
`;

    const tgURL = `https://api.telegram.org/bot${TOKEN}`;

    if (photo) {
      const fd = new FormData();
      fd.append("chat_id", CHAT_ID);
      fd.append("caption", text);
      fd.append("parse_mode", "HTML");
      fd.append("photo", photo.buffer, {
        filename: photo.originalname,
        contentType: photo.mimetype,
      });
      await fetch(`${tgURL}/sendPhoto`, { method: "POST", body: fd });
    } else {
      await fetch(`${tgURL}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "HTML" }),
      });
    }

    console.log("✅ Order sent to Telegram");
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
