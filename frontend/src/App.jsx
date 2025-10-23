import { useState, useEffect } from 'react';

export default function GeminiStreamingApp() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [backendStatus, setBackendStatus] = useState({ status: 'checking...', gemini: false });
  const [streamType, setStreamType] = useState('ai'); // 'ai' or 'simulated'
  const [chunkCount, setChunkCount] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [chunkTimings, setChunkTimings] = useState([]);

  useEffect(() => {
    checkBackend();
  }, []);

  const checkBackend = async () => {
    try {
      const res = await fetch('http://localhost:5000/health');
      const data = await res.json();
      setBackendStatus({
        status: data.status === 'ok' ? '✓ Connected' : '✗ Error',
        gemini: data.gemini_configured
      });
    } catch (err) {
      setBackendStatus({ status: '✗ Not running', gemini: false });
    }
  };

  const startStream = (type) => {
    setResponse('');
    setChunkCount(0);
    setChunkTimings([]);
    setIsStreaming(true);
    setStreamType(type);
    setStartTime(Date.now());

    const endpoint = type === 'ai' ? 'stream-ai' : 'stream-simulated';
    
    // Using fetch with ReadableStream for proper streaming
    fetch(`http://localhost:5000/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message || 'Tell me a short interesting fact about quantum computing' })
    })
    .then(response => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const readChunk = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            setIsStreaming(false);
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          lines.forEach(line => {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              const timing = Date.now() - startTime;
              
              if (data.chunk) {
                setResponse(prev => prev + data.chunk);
                setChunkCount(c => c + 1);
                setChunkTimings(prev => [...prev, timing]);
              }
              
              if (data.type === 'complete') {
                setIsStreaming(false);
              }
              
              if (data.error) {
                setResponse(prev => prev + `\n\n[Error: ${data.error}]`);
                setIsStreaming(false);
              }
            }
          });

          readChunk();
        });
      };

      readChunk();
    })
    .catch(error => {
      setResponse(`Error: ${error.message}`);
      setIsStreaming(false);
    });
  };

  const calculateStats = () => {
    if (chunkTimings.length < 2) return null;
    
    const intervals = [];
    for (let i = 1; i < chunkTimings.length; i++) {
      intervals.push(chunkTimings[i] - chunkTimings[i-1]);
    }
    
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const min = Math.min(...intervals);
    const max = Math.max(...intervals);
    
    return { avg: avg.toFixed(0), min, max, intervals };
  };

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                🤖 AI Streaming Comparison
              </h1>
              <p className="text-gray-600">Real Gemini AI vs Simulated Streaming</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">Backend: 
                <span className={`ml-2 font-semibold ${
                  backendStatus.status.includes('✓') ? 'text-green-600' : 'text-red-600'
                }`}>
                  {backendStatus.status}
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                Gemini API: 
                <span className={`ml-2 font-semibold ${
                  backendStatus.gemini ? 'text-green-600' : 'text-amber-600'
                }`}>
                  {backendStatus.gemini ? '✓ Configured' : '⚠ Not set'}
                </span>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mb-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
            <p className="text-sm text-blue-900">
              <strong>Key Difference:</strong> Real AI streaming sends chunks as they're generated (irregular timing), 
              while simulated streaming uses artificial delays (regular timing). Watch the timing statistics below!
            </p>
          </div>

          {/* Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Message (optional - defaults to quantum computing question)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask anything... (leave empty for default question)"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:outline-none resize-none"
              rows="3"
              disabled={isStreaming}
            />
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => startStream('ai')}
              disabled={isStreaming || !backendStatus.gemini}
              className={`py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                isStreaming || !backendStatus.gemini
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {isStreaming && streamType === 'ai' ? '⚡ Streaming...' : '🤖 Real AI Stream'}
            </button>

            <button
              onClick={() => startStream('simulated')}
              disabled={isStreaming}
              className={`py-3 px-6 rounded-lg font-semibold text-white transition-all ${
                isStreaming
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg hover:shadow-xl'
              }`}
            >
              {isStreaming && streamType === 'simulated' ? '⏱️ Streaming...' : '🔄 Simulated Stream'}
            </button>
          </div>

          {/* Response Display */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-700">
                Response:
              </h2>
              {isStreaming && (
                <div className="flex items-center gap-2">
                  <div className="animate-pulse flex space-x-1">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                    <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                  </div>
                  <span className="text-sm text-indigo-600 font-medium">
                    {chunkCount} chunks
                  </span>
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 min-h-[200px] border-2 border-gray-200">
              {response ? (
                <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {response}
                  {isStreaming && <span className="animate-pulse">▊</span>}
                </div>
              ) : (
                <p className="text-gray-400 italic">
                  Click a button above to start streaming...
                </p>
              )}
            </div>
          </div>

          {/* Statistics */}
          {stats && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
              <h3 className="font-semibold text-gray-800 mb-3">📊 Streaming Statistics</h3>
              <div className="grid grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-gray-600">Total Chunks</div>
                  <div className="text-xl font-bold text-indigo-600">{chunkCount}</div>
                </div>
                <div>
                  <div className="text-gray-600">Avg Interval</div>
                  <div className="text-xl font-bold text-indigo-600">{stats.avg}ms</div>
                </div>
                <div>
                  <div className="text-gray-600">Min Interval</div>
                  <div className="text-xl font-bold text-green-600">{stats.min}ms</div>
                </div>
                <div>
                  <div className="text-gray-600">Max Interval</div>
                  <div className="text-xl font-bold text-red-600">{stats.max}ms</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-600">
                <strong>Note:</strong> {streamType === 'ai' 
                  ? 'Real AI shows variable intervals based on token generation speed' 
                  : 'Simulated stream shows consistent ~1000ms intervals'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}