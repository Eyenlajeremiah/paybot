import { useState } from 'react';

// Notice: No more GoogleGenAI import! No more API keys!

function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [messages, setMessages] = useState<any[]>([
    { 
      role: 'assistant', 
      text: 'Hello! I\'m your PingPay Agent. Tell me who you want to pay and how much.\n\nExample: "Pay Alice 50 USDC"' 
    }
  ]);

  // 1. Send text to our secure backend to parse
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call our new Node.js backend
      const response = await fetch('https://paybot-vrg4.onrender.com/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userMessage.text })
      });

      if (!response.ok) throw new Error("Backend parsing failed");
      const parsedData = await response.json();

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
            status: 'pending' 
          }
        }
      ]);

    } catch (error) {
      console.error(error);
      setMessages((prev) => [...prev, { role: 'assistant', text: "Oops! Something went wrong communicating with the server." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Send transaction details to backend to get PingPay URL
  const handlePay = async (messageIndex: number, paymentData: any) => {
    const updatedMessages = [...messages];
    updatedMessages[messageIndex].paymentData.status = 'processing';
    setMessages(updatedMessages);

    try {
      // Call our new Node.js backend
      const response = await fetch('https://paybot-vrg4.onrender.com/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentData.amount,
          token: paymentData.token,
          successUrl: window.location.origin + '?status=success',
          cancelUrl: window.location.origin + '?status=cancelled'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate session");
      }

      const data = await response.json();
      window.location.href = data.sessionUrl;

    } catch (error: any) {
      console.error("Checkout Error:", error);
      
      const finalMessages = [...messages];
      finalMessages[messageIndex].paymentData.status = 'pending';
      setMessages((prev) => [
        ...finalMessages,
        { role: 'assistant', text: `❌ Backend Error: ${error.message}` }
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <header className="bg-white shadow-sm p-4 flex justify-between items-center border-b border-gray-100">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          🤖 <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">PayBot</span>
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
                
                {msg.paymentData && (
                  <div className="mt-4 border border-gray-100 bg-gray-50 rounded-xl p-5 shadow-inner">
                    <div className="flex justify-between items-center mb-5 pb-4 border-b border-gray-200">
                      <div>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Sending to</p>
                        <p className="font-bold text-gray-900 text-lg capitalize">{msg.paymentData.recipient}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Amount</p>
                        <p className="font-bold text-gray-900 text-xl">{msg.paymentData.amount} {msg.paymentData.token}</p>
                      </div>
                    </div>
                    
                    {msg.paymentData.status === 'pending' && (
                      <button 
                        onClick={() => handlePay(index, msg.paymentData)}
                        className="w-full bg-green-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-600 transition shadow-sm flex items-center justify-center gap-2 text-sm"
                      >
                        Pay via PingPay ⚡
                      </button>
                    )}

                    {msg.paymentData.status === 'processing' && (
                      <button disabled className="w-full bg-yellow-500 text-white font-bold py-3 px-4 rounded-lg shadow-sm flex justify-center items-center gap-2 text-sm">
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