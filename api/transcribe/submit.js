export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Handle Monday.com webhook challenge verification
  if (req.body?.challenge) {
    return res.status(200).json({ challenge: req.body.challenge });
  }

  const event = req.body?.event;

  if (!event) {
    return res.status(400).json({ error: 'No event in request body' });
  }

  // Only process file_mm1daxvv (Call recordings) column changes
  if (event.columnId !== 'file_mm1daxvv') {
    return res.status(200).json({ status: 'skipped' });
  }

  const itemId = event.pulseId;

  if (!itemId) {
    return res.status(400).json({ error: 'No pulseId in event' });
  }

  const MONDAY_TOKEN = process.env.MONDAY_API_TOKEN;
  const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;

  try {
    // Get the audio file URL from Monday assets
    const fileUrl = await getMondayAudioUrl(itemId, MONDAY_TOKEN);

    if (!fileUrl) {
      return res.status(400).json({ error: 'No audio file found on this Monday item' });
    }

    // Submit to AssemblyAI — callback URL carries Monday item ID as query param
    const callbackUrl = `https://audiotext.stayful.co.uk/api/transcribe/callback?itemId=${itemId}`;

    const aaiResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: fileUrl,
        speaker_labels: true,
        speech_model: 'universal-2',
        webhook_url: callbackUrl
      })
    });

    const aaiData = await aaiResponse.json();

    if (!aaiResponse.ok) {
      console.error('AssemblyAI submit error:', aaiData);
      return res.status(500).json({ error: 'Failed to submit to AssemblyAI', details: aaiData });
    }

    console.log(`Transcription submitted for item ${itemId}, transcript_id: ${aaiData.id}`);
    return res.status(200).json({ success: true, transcript_id: aaiData.id });

  } catch (error) {
    console.error('Transcription submit error:', error);
    return res.status(500).json({ error: error.message });
  }
}


// ─── Monday asset fetch ───────────────────────────────────────────────────────

async function getMondayAudioUrl(itemId, token) {
  const query = `
    query {
      items(ids: [${itemId}]) {
        assets {
          id
          name
          public_url
          file_extension
        }
      }
    }
  `;

  const data = await mondayRequest(query, token);
  const assets = data?.data?.items?.[0]?.assets || [];

  const audioExts = ['mp3', 'mp4', 'wav', 'm4a', 'ogg', 'webm', 'aac', 'flac'];
  const audioAsset = assets.find(a => {
    const ext = (a.file_extension || '').replace(/^\./, '').toLowerCase()
      || (a.name || '').split('.').pop().toLowerCase();
    return audioExts.includes(ext);
  });

  return audioAsset?.public_url || null;
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

async function mondayRequest(query, token) {
  const response = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify({ query })
  });
  return response.json();
}
