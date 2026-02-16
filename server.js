import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

// Load environment variables from .env
dotenv.config();

const app = express();

// Allow our React frontend to talk to this backend
app.use(cors());
app.use(express.json());

// Initialize Gemini safely on the server
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 🚨 ROUTE 1: Parse the natural language prompt
app.post('/api/parse', async (req, res) => {
  try {
    const { text } = req.body;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: text,
      config: {
        systemInstruction: "You are a payment parser. Extract the amount, token, and recipient from the user's message. Return strictly valid JSON in this format: { \"recipient\": \"string\", \"amount\": \"number\", \"token\": \"string\" }. If information is missing, use null.",
        responseMimeType: "application/json"
      }
    });

    const parsedData = JSON.parse(response.text || '{}');
    res.json(parsedData);

  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to parse message with AI." });
  }
});

// 🚨 ROUTE 2: Securely create the PingPay checkout session
app.post('/api/checkout', async (req, res) => {
  try {
    const { amount, token, successUrl, cancelUrl } = req.body;
    
    // Calculate smallest units safely on the backend
    const amountInSmallestUnit = (Number(amount) * 1000000).toString();

    const pingResponse = await fetch('https://pay.pingpay.io/api/checkout/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.PINGPAY_API_KEY // 🔒 Safe from the browser!
      },
      body: JSON.stringify({
        amount: amountInSmallestUnit,
        asset: {
          chain: 'NEAR', 
          symbol: token?.toUpperCase() || 'USDC'
        },
        successUrl,
        cancelUrl
      })
    });

    if (!pingResponse.ok) {
      const errorData = await pingResponse.json().catch(() => ({}));
      throw new Error(errorData.message || `PingPay API Error (Status: ${pingResponse.status})`);
    }

    const data = await pingResponse.json();
    res.json({ sessionUrl: data.sessionUrl });

  } catch (error) {
    console.error("PingPay Error:", error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Secure Backend running on http://localhost:${PORT}`);
});