export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { itemId } = req.query;
  const { transcript_id, status } = req.body;

  if (!itemId) {
    return res.status(400).json({ error: 'itemId query parameter is required' });
  }

  if (!transcript_id) {
    return res.status(400).json({ error: 'transcript_id is required' });
  }

  const MONDAY_TOKEN = process.env.MONDAY_API_TOKEN;
  const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_API_KEY;

  // Handle transcription error from AssemblyAI
  if (status === 'error') {
    console.error(`Transcription failed for item ${itemId}, transcript_id: ${transcript_id}`);
    await postMondayUpdate(itemId, '⚠️ Transcription failed — please re-upload the recording or check AssemblyAI.', MONDAY_TOKEN);
    return res.status(200).json({ received: true });
  }

  // Ignore non-terminal statuses (queued, processing)
  if (status !== 'completed') {
    return res.status(200).json({ received: true, status });
  }

  try {
    // Fetch the full transcript from AssemblyAI
    const transcriptResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${transcript_id}`, {
      headers: {
        'Authorization': ASSEMBLYAI_KEY
      }
    });

    const transcript = await transcriptResponse.json();

    if (!transcriptResponse.ok || transcript.status !== 'completed') {
      console.error('AssemblyAI transcript fetch error:', transcript);
      return res.status(500).json({ error: 'Failed to fetch transcript from AssemblyAI' });
    }

    // Format and post to Monday
    const formatted = formatTranscript(transcript);
    await postMondayUpdate(itemId, formatted, MONDAY_TOKEN);

    console.log(`Transcript posted to Monday item ${itemId}`);
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Transcript callback error:', error);
    return res.status(500).json({ error: error.message });
  }
}


// ─── Transcript formatter ─────────────────────────────────────────────────────

function formatTranscript(transcript) {
  const utterances = transcript.utterances || [];
  const lines = ['**Call Recording Transcript**', ''];

  if (utterances.length > 0) {
    for (const u of utterances) {
      const speaker = u.speaker === 'A' ? '**Stayful Agent:**' : '**Lead:**';
      lines.push(`${speaker} ${u.text}`);
      lines.push('');
    }
  } else {
    // Fallback if speaker labels not available
    lines.push(transcript.text || 'No transcript text available.');
    lines.push('');
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { dateStyle: 'long' });
  const timeStr = now.toLocaleTimeString('en-GB', { timeStyle: 'short' });

  lines.push('---');
  lines.push(`*Transcribed: ${dateStr} at ${timeStr}*`);

  return lines.join('\n');
}


// ─── Monday update ────────────────────────────────────────────────────────────

async function postMondayUpdate(itemId, body, token) {
  const response = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify({
      query: `mutation { create_update(item_id: ${itemId}, body: ${JSON.stringify(body)}) { id } }`
    })
  });
  return response.json();
}
