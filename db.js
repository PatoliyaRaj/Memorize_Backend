require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

let WebSocketTransport = null;
try {
  WebSocketTransport = require('ws');
} catch (e) {
 console.log("WebSocketTransport (ws package) not available, realtime features will be disabled. To enable, install ws (npm i ws) or upgrade Node to v22+.");
}

let pgPool = null;
let supabase = null;

function getPgPool() {
  if (pgPool) return pgPool;
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL is not set');
  }
  pgPool = new Pool({ connectionString, max: 20 });
  // Optional: attach error handler
  pgPool.on('error', (err) => {
    console.error('Unexpected PG pool error', err);
  });
  console.log("local postgress is connected");
  return pgPool;
}

function getSupabase() {
  if (supabase) return supabase;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.warn('Supabase credentials not fully set; supabase client will still be created but may fail on requests.');
  }
  // Provide realtime transport option when ws is available (Node < 22 compatibility)
  const options = {};
  if (WebSocketTransport) {
    options.realtime = { transport: WebSocketTransport };
  } else {
    // If Node < 22 and ws isn't installed, the Realtime client will throw an error.
    // Provide a helpful warning so the developer can install the `ws` package or upgrade Node.
    if (process.version && process.version.startsWith('v20')) {
      console.warn('Node.js 20 detected and `ws` not installed. To enable Supabase Realtime install `ws` (npm i ws) or upgrade Node to v22+.');
    }
  }

  supabase = createClient(url || '', anonKey || '', options);
  console.log("Supabase client initialized");
  return supabase;
}

module.exports = { getPgPool, getSupabase };
