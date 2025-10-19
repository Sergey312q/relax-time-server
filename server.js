require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const multer = require('multer');
const FormData = require('form-data');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // In production, restrict this to your frontend origin

const upload = multer({ storage: multer.memoryStorage() });

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const NP_API_KEY = process.env.NP_API_KEY;

if(!BOT_TOKEN || !CHAT_ID || !NP_API_KEY){
  console.warn("Warning: BOT_TOKEN, CHAT_ID or NP_API_KEY is not set. Check your .env");
}

// GET / -> simple info
app.get('/', (req,res)=>res.send('Relax Time API running'));

// Proxy for Nova Poshta - getCities
app.post('/api/getCities', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'missing query' });

    const resp = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: NP_API_KEY,
        modelName: 'Address',
        calledMethod: 'getCities',
        methodProperties: { FindByString: query }
      })
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Proxy for Nova Poshta - getWarehouses
app.post('/api/getWarehouses', async (req, res) => {
  try {
    const { cityRef } = req.body;
    if (!cityRef) return res.status(400).json({ error: 'missing cityRef' });

    const resp = await fetch('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: NP_API_KEY,
        modelName: 'AddressGeneral',
        calledMethod: 'getWarehouses',
        methodProperties: { CityRef: cityRef }
      })
    });
    const data = await resp.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// Endpoint to receive order and forward photo+caption to Telegram
app.post('/api/sendOrder', upload.single('photo'), async (req, res) => {
  try {
    const { city, warehouse, name } = req.body;
    const file = req.file;
    if (!city || !warehouse || !name || !file) {
      return res.status(400).json({ error: 'missing fields' });
    }

    const caption = `🛍 Нове замовлення!\n🏙 Місто: ${city}\n🏤 Відділення: ${warehouse}\n👤 ПІБ: ${name}`;

    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('caption', caption);
    form.append('photo', file.buffer, { filename: 'order.jpg', contentType: file.mimetype });

    const tgResp = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: form
    });
    const tgJson = await tgResp.json();
    if (!tgJson.ok) {
      console.error('tg error', tgJson);
      return res.status(502).json({ error: 'telegram error', details: tgJson });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
});

// simple health
app.get('/api/health', (req,res)=>res.json({ok:true}));

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log(`Server listening on ${PORT}`));
