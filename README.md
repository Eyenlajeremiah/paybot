# 🤖 PayBot: AI-Powered PingPay Orchestrator

**Generate secure Web3 checkout links at the speed of thought.** Built for the PingPay Ecosystem Track.

## 📖 Overview
**PayBot** is an AI agent designed for Web3 merchants, freelancers, and DAOs. Instead of navigating through complex dashboards to manually generate payment links, merchants can simply tell PayBot what they need in natural language (e.g., *"Create an invoice for Alice for 50 USDC"*). 

The AI instantly parses the request, orchestrates a server-to-server handshake with the **PingPay API**, and generates a secure, cross-chain Hosted Checkout link that settles directly into the merchant's verified organization wallet.

## ✨ Key Features
* **🧠 Natural Language Processing:** Powered by Google's `gemini-2.5-flash` model, PayBot accurately extracts invoice details (Client Name, Amount, Token) from conversational prompts.
* **⚡ PingPay Integration:** Deeply integrated with PingPay's `v1/checkout/sessions` REST API.
* **🛡️ Merchant-First Architecture:** Utilizes secure server-to-server API Key authentication. Funds are safely routed to the merchant's predefined PingPay dashboard wallet, preventing client-side tampering.
* **🔄 Bypassing CORS for Seamless Dev:** Implements a custom Vite Proxy to securely tunnel API requests to PingPay without exposing backend architecture during the hackathon demo.

## 🏗️ How It Works (The Architecture)
1. **The Prompt:** The merchant types an invoicing request into the chat interface.
2. **AI Parsing:** The Gemini LLM parses the string and returns a strictly formatted JSON object `{"recipient": string, "amount": number, "token": string}`.
3. **Micro-Unit Conversion:** The app automatically converts standard token amounts (e.g., 50 USDC) into the smallest blockchain units (e.g., 50000000) required by PingPay.
4. **Session Generation:** The app securely calls the PingPay API using `x-api-key` authentication to generate a unique `sessionId` and `sessionUrl`.
5. **The Handoff:** PayBot presents the merchant with a sleek invoice card containing the Hosted Checkout link, ready to be sent to the client. The client pays via NEAR Intents, and it settles cross-chain.

## 🛠️ Tech Stack
* **Frontend:** React, Vite, Tailwind CSS v4
* **AI Engine:** Google Gemini SDK (`@google/genai`)
* **Payment Orchestration:** PingPay Hosted Checkout API
* **Network:** NEAR Protocol (via PingPay Intents)

## 🚀 Running Locally

### Prerequisites
* Node.js (v18+)
* A PingPay Developer API Key
* A Google Gemini API Key

### 1. Clone the repository
```bash
git clone [https://github.com/Eyenlajeremiah/paybot.git](https://github.com/Eyenlajeremiah
/paybot.git)
cd paybot