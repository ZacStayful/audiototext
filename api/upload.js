async function handler(req, res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') { res.status(200).end(); return; }
      if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
      try {
              const chunks = [];
              for await (const chunk of req) chunks.push(chunk);
              const body = Buffer.concat(chunks);
              const response = await fetch('https://api.assemblyai.com/v2/upload', {
                        method: 'POST',
                        headers: {
                                    'authorization': process.env.ASSEMBLYAI_API_KEY,
                                    'content-type': 'application/octet-stream'
                        },
                        body
              });
              const data = await response.json();
              res.status(response.status).json(data);
      } catch (err) {
              res.status(500).json({ error: err.message });
      }
}
handler.config = { api: { bodyParser: false } };
module.exports = handler;
