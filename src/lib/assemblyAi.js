const ASSEMBLY_AI_KEY = 'd6733ece0099465b976f3251fe9e8454';
const BASE_URL = 'https://api.assemblyai.com/v2';

export const uploadAudio = async (file) => {
  try {
    const response = await fetch(`${BASE_URL}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLY_AI_KEY,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.upload_url;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

export const startTranscription = async (audioUrl) => {
  try {
    const response = await fetch(`${BASE_URL}/transcript`, {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLY_AI_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_code: 'pt',
        speaker_labels: false, // Single speaker mode
      }),
    });

    if (!response.ok) {
      throw new Error(`Transcription start failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error('Error starting transcription:', error);
    throw error;
  }
};

export const checkTranscriptionStatus = async (transcriptId) => {
  try {
    const response = await fetch(`${BASE_URL}/transcript/${transcriptId}`, {
      method: 'GET',
      headers: {
        'Authorization': ASSEMBLY_AI_KEY,
      },
    });

    if (!response.ok) {
      throw new Error(`Status check failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error checking status:', error);
    throw error;
  }
};