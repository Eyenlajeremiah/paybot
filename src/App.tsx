import { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [messages, setMessages] = useState<any[]>([
    { 
      role: 'assistant', 
      text: 'Hello! I\'m your PingPay Agent. Tell me who you want to pay and how much.\n\nExample: "Pay Alice 50 USDC"' 
    }
  ]);

  //  PHASE 5 POLISH: Catch the user returning from PingPay
  useEffect(() => {
    // 1. Read the URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');

    // 2. If they just finished a successful payment...
    if (status === 'success') {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: '✅ Welcome back! I have successfully verified your PingPay transaction. The funds have been securely routed and settled.'
        }
      ]);
      // Clean up the URL so refreshing doesn't duplicate the message!
      window.history.replaceState({}, document.title, window.location.pathname);
    } 
    // 3. Or if they backed out of the checkout...
    else if (status === 'cancelled') {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: '❌ Welcome back. It looks like the payment was cancelled. Let me know when you are ready to try again!'
        }
      ]);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []); // The empty brackets [] mean this only runs exactly once when the page loads


  // 1. THIS HANDLES THE AI PARSING
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({
        apiKey: import.meta.env.VITE_GEMINI_API_KEY
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userMessage.text,
        config: {
          systemInstruction: "You are a payment parser. Extract the amount, token, and recipient from the user's message. Return strictly valid JSON in this format: { \"recipient\": \"string\", \"amount\": \"number\", \"token\": \"string\" }. If information is missing, use null.",
          responseMimeType: "application/json"
        }
      });

      const parsedData = JSON.parse(response.text || '{}');

      if (!parsedData.amount || !parsedData.recipient) {
        setMessages((prev) => [
          ...prev, 
          { role: 'assistant', text: "I couldn't quite catch all the details. Could you specify the amount, the token, and who you are paying?" }
        ]);
        setIsLoading(false);
        return;
      }

      setMessages((prev) => [
        ...prev, 
        { 
          role: 'assistant', 
          text: `I've prepared your PingPay transaction for ${parsedData.amount} ${parsedData.token?.toUpperCase() || 'USDC'} to ${parsedData.recipient}.`,
          paymentData: {
            amount: parsedData.amount,
            token: parsedData.token?.toUpperCase() || 'USDC',
            recipient: parsedData.recipient,
            status: 'pending' // We set it to pending so the button shows up
          }
        }
      ]);

    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev, 
        { role: 'assistant', text: "Oops! Something went wrong while parsing that request." }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
// 🚨 OFFICIAL PINGPAY API INTEGRATION
  const handlePay = async (messageIndex: number, paymentData: any) => {
    const updatedMessages = [...messages];
    updatedMessages[messageIndex].paymentData.status = 'processing';
    setMessages(updatedMessages);

    try {
      // Convert amount to smallest units (USDC has 6 decimals, so multiply by 1,000,000)
      // I convert it to a string as required by the PingPay docs
      const amountInSmallestUnit = (Number(paymentData.amount) * 1000000).toString();

      // Make the HTTP request via our Vite Proxy (/pingpay-api) to bypass CORS
      const response = await fetch('/pingpay-api/api/checkout/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          //  Official header for PingPay
          'x-api-key': import.meta.env.VITE_PINGPAY_API_KEY
        },
        body: JSON.stringify({
          amount: amountInSmallestUnit,
          asset: {
            chain: 'NEAR', 
            symbol: paymentData.token?.toUpperCase() || 'USDC'
          },
          successUrl: window.location.origin + '?status=success', 
          cancelUrl: window.location.origin + '?status=cancelled'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to generate PingPay session (Status: ${response.status})`);
      }

      // 🚨 Extract the official sessionUrl
      const data = await response.json();
      
      if (data.sessionUrl) {
        // Redirect the user to the actual checkout page!
        window.location.href = data.sessionUrl;
      } else {
        throw new Error('API connected, but did not return a sessionUrl');
      }

    } catch (error: any) {
      console.error("PingPay API Error:", error);
      
      const finalMessages = [...messages];
      finalMessages[messageIndex].paymentData.status = 'pending';
      setMessages((prev) => [
        ...finalMessages,
        {
          role: 'assistant',
          text: `❌ API Error: ${error.message}`
        }
      ]);
    }
  };
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <img src="/logo.png" alt="PayBot Logo" className="w-8 h-8 object-contain" />
          <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">PayBot</span>
        </h1>
        
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-4 max-w-[80%] shadow-sm rounded-2xl whitespace-pre-wrap ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-sm' 
                  : 'bg-white border border-gray-200 text-gray-700 rounded-tl-sm'
              }`}>
                {msg.text}
                
                {/*  Interactive PingPay Checkout Card UI! */}
                {msg.paymentData && (
                  <div className="mt-4 border border-gray-100 bg-gray-50 rounded-xl p-4 shadow-inner">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Sending to</p>
                        <p className="font-bold text-gray-900 capitalize">{msg.paymentData.recipient}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 font-medium">Amount</p>
                        <p className="font-bold text-gray-900">{msg.paymentData.amount} {msg.paymentData.token}</p>
                      </div>
                    </div>
                    
                    {/* The button changes based on our API status */}
                    {msg.paymentData.status === 'pending' && (
                      <button 
                        onClick={() => handlePay(index, msg.paymentData)}
                        className="w-full bg-green-500 text-white font-bold py-3 rounded-lg hover:bg-green-600 transition shadow-sm"
                      >
                        Pay via PingPay ⚡
                      </button>
                    )}

                    {msg.paymentData.status === 'processing' && (
                      <button disabled className="w-full bg-yellow-500 text-white font-bold py-3 rounded-lg shadow-sm flex justify-center items-center gap-2">
                        <span className="animate-spin text-xl">⏳</span> Processing...
                      </button>
                    )}
                  </div>
                )}

              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 p-4 rounded-2xl rounded-tl-sm shadow-sm flex gap-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="bg-white border-t p-4 pb-8">
        <form onSubmit={handleSend} className="max-w-3xl mx-auto flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your payment request (e.g., 'Pay bob 100 near')..." 
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            disabled={isLoading}
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  );
}

export default App;