require('dotenv').config();
const OpenAI = require('openai');

const apiKey = process.env.NVIDIA_NIM_API_KEY;
const client = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://integrate.api.nvidia.com/v1',
});

async function run() {
  try {
    const response = await client.models.retrieve('nvidia/nemotron-parse');
    console.log('NEMOTRON-PARSE RETRIEVED:', response.id);
  } catch (error) {
    console.error('NEMOTRON-PARSE RETRIEVE FAILED:', error.message);
  }
}

run();
