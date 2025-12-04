const textToSpeech = require('@google-cloud/text-to-speech');
const client = new textToSpeech.TextToSpeechClient();

async function quickTest() {
  const request = {
    input: { text: 'Hello from Kanopy!' },
    voice: { languageCode: 'en-US', ssmlGender: 'NEUTRAL' },
    audioConfig: { audioEncoding: 'MP3' },
  };
  try {
    const [response] = await client.synthesizeSpeech(request);
    console.log('Success:', !!response.audioContent);
  } catch (err) {
    console.error('Error:', err);
  }
}

quickTest();