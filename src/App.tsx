import { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';

function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // 🚨 NEW: Added state to track which receipt is currently downloading
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  
  const [messages, setMessages] = useState<any[]>([
    { 
      role: 'assistant', 
      text: 'Hello! I\'m your PingPay Agent. Tell me who you want to pay and how much.\n\nExample: "Pay Alice 50 USDC"' 
    }
  ]);

  // 🚨 FIXED: Bulletproof download function
  const downloadReceipt = async (elementId: string) => {
    try {
      setDownloadingId(elementId); // Trigger the loading text on the button
      const element = document.getElementById(elementId);
      
      if (!element) {
        console.error("Receipt element not found!");
        return;
      }

      // Take the snapshot
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff' // Ensure background is solid white
      });
      
      const data = canvas.toDataURL('image/png');
      
      // Create an invisible link, attach it to the page, click it, and remove it
      const link = document.createElement('a');
      link.href = data;
      link.download = `PayBot_Receipt_${Date.now()}.png`;
      document.body.appendChild(link); // Required by some modern browsers
      link.click();
      document.body.removeChild(link);

    } catch (error) {
      console.error("Failed to generate receipt:", error);
      alert("Failed to download the receipt. Please try again.");
    } finally {
      setDownloadingId(null); // Reset the button
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const txStatus = urlParams.get('txStatus');
    const sessionId = urlParams.get('sessionId');

    if (status === 'success' || txStatus === 'SUCCESS') {
      const lastTx = JSON.parse(localStorage.getItem('lastTx') || '{}');

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `✅ Payment Successful! Here is your generated receipt.`,
          isReceipt: true,
          receiptData: {
            amount: lastTx.amount || 'Unknown',
            token: lastTx.token || 'USDC',
            recipient: lastTx.recipient || 'Unknown',
            sessionId: sessionId || 'N/A',
            date: new Date().toLocaleString()
          }
        }
      ]);
      
      localStorage.removeItem('lastTx');
      window.history.replaceState({}, document.title, window.location.pathname);

    } else if (status === 'cancelled') {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: '❌ Payment was cancelled.' }
      ]);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
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

  const handlePay = async (messageIndex: number, paymentData: any) => {
    const updatedMessages = [...messages];
    updatedMessages[messageIndex].paymentData.status = 'processing';
    setMessages(updatedMessages);

    try {
      localStorage.setItem('lastTx', JSON.stringify({
        amount: paymentData.amount,
        token: paymentData.token,
        recipient: paymentData.recipient
      }));

      const baseUrl = window.location.origin + window.location.pathname;

      const response = await fetch('https://paybot-vrg4.onrender.com/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentData.amount,
          token: paymentData.token,
          successUrl: baseUrl + '?status=success',
          cancelUrl: baseUrl + '?status=cancelled'
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

                {msg.isReceipt && (
                  <div className="mt-4 w-72 max-w-full flex flex-col gap-2">
                    <div id={`receipt-${index}`} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden font-sans">
                      <div className="bg-green-500 p-3 flex justify-center items-center gap-2">
                        <span className="text-white text-xl">✓</span>
                        <h3 className="text-white font-bold text-md m-0">Payment Receipt</h3>
                      </div>
                      <div className="p-4 space-y-3 text-sm text-gray-800">
                        <div className="flex justify-between border-b border-dashed pb-2">
                          <span className="text-gray-500">Amount Paid</span>
                          <span className="font-bold">{msg.receiptData.amount} {msg.receiptData.token}</span>
                        </div>
                        <div className="flex justify-between border-b border-dashed pb-2">
                          <span className="text-gray-500">Sent To</span>
                          <span className="font-bold capitalize">{msg.receiptData.recipient}</span>
                        </div>
                        <div className="flex justify-between border-b border-dashed pb-2">
                          <span className="text-gray-500">Session ID</span>
                          <span className="font-mono text-[10px] bg-gray-100 p-1 rounded max-w-[100px] truncate" title={msg.receiptData.sessionId}>
                            {msg.receiptData.sessionId}
                          </span>
                        </div>
                        <div className="flex justify-between pt-1">
                          <span className="text-gray-500 text-xs">Date</span>
                          <span className="font-medium text-xs">{msg.receiptData.date}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* 🚨 FIXED: Download button now shows a loading state and becomes transparent when clicked */}
                    <button 
                      onClick={() => downloadReceipt(`receipt-${index}`)}
                      disabled={downloadingId === `receipt-${index}`}
                      className="w-full bg-blue-100 text-blue-700 font-bold py-2 px-4 rounded-lg hover:bg-blue-200 transition text-sm flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {downloadingId === `receipt-${index}` ? '⏳ Generating...' : '⬇️ Download PNG Image'}
                    </button>
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