export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'POST') {
      const response = await fetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          'authorization': process.env.ASSEMBLYAI_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      res.status(response.status).json(data);

    } else if (req.method === 'GET') {
      const { id } = req.query;
      if (!id) { res.status(400).json({ error: 'Missing id' }); return; }
      const response = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { 'authorization': process.env.ASSEMBLYAI_API_KEY }
      });
      const data = await response.json();
      res.status(response.status).json(data);

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
