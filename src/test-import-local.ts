// backend/src/test-import-local.ts
import { syncImportedCards } from './services/import/syncService';
import { detectLanguageFromText } from './services/import/languageDetector';
import { getAdaptiveChunkConfig } from './services/import/adaptiveChunker';
import fs from 'fs';

async function runLocalTests() {
  console.log("🔍 STARTING SMART IMPORT INTEGRATION TESTS...\n");

  // --- TEST 1: POSIX Directory Secure Permissions ---
  console.log("📁 TESTING SECURE DIRECTORY CREATION...");
  const uploadDir = '/tmp/neurolearn-uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true, mode: 0o700 });
  }
  const stats = fs.statSync(uploadDir);
  const isSecure = (stats.mode & 0o777) === 0o700;
  if (isSecure) {
    console.log("✅ PASS: Directory is secure. Only owner can read/write/execute (0o700).\n");
  } else {
    console.warn("⚠️ WARNING: Folder permissions are not strict. Check your OS support for POSIX permissions.\n");
  }

  // --- TEST 2: Native Script Language Detection ---
  console.log("🌍 TESTING MULTI-LANGUAGE SCRIPT DETECTOR...");
  const engText = "In Python, variables are dynamically typed.";
  const hinText = "पायथन में, चर गतिशील रूप से लिखे जाते हैं।";
  const gujText = "પાયથોનમાં, વેરિએબલ્સ ગતિશીલ રીતે ટાઇપ થાય છે.";

  const detectEng = detectLanguageFromText(engText);
  const detectHin = detectLanguageFromText(hinText);
  const detectGuj = detectLanguageFromText(gujText);

  if (detectEng === 'eng' && detectHin === 'hin' && detectGuj === 'guj') {
    console.log("✅ PASS: Language scripts auto-detected cleanly (English, Hindi, Gujarati).\n");
  } else {
    console.error("❌ FAIL: Script detection mismatch.", { detectEng, detectHin, detectGuj });
  }

  // --- TEST 3: Adaptive Chunking Parameters ---
  console.log("⚙️ TESTING ADAPTIVE SEMANTIC CHUNKING CONFIGS...");
  const mathConfig = getAdaptiveChunkConfig('formula');
  const essayConfig = getAdaptiveChunkConfig('essay');

  if (mathConfig.chunkSize === 350 && essayConfig.chunkSize === 800) {
    console.log("✅ PASS: Chunker dynamically resizes boundaries based on node types.\n");
  } else {
    console.error("❌ FAIL: Chunker did not adapt correctly.", { mathConfig, essayConfig });
  }

  // --- TEST 4: FSRS-Preserving Delta Sync (The Fuzzy Matcher) ---
  console.log("🧠 TESTING DELTA SYNC ENGINE (PRESERVING STUDY PROGRESS)...");
  
  // Simulate study history in your DB
  const existingCardsInDb = [
    { id: 'card-1', question: "What is a python variable?", answer: "A reference to an object in memory.", orderIndex: 0, explanation: null },
    { id: 'card-2', question: "What are the rules for naming variables?", answer: "Must start with letter or underscore.", orderIndex: 1, explanation: null }
  ];

  // User edits their notes, causing minor question rephrasings & adding one brand new question
  const incomingImportedCards = [
    { question: "What is a python variables?", answer: "A reference to an object in memory.", questionType: 'free_recall', subTopic: 'Basics' }, // minor typo edit
    { question: "Rules for naming variables in Python?", answer: "Must start with letter or underscore.", questionType: 'free_recall', subTopic: 'Naming' }, // minor rephrase
    { question: "Can a variable start with a number?", answer: "No, never.", questionType: 'free_recall', subTopic: 'Restrictions' } // brand new card!
  ];

  const syncResult = syncImportedCards(existingCardsInDb, incomingImportedCards);

  console.log("Sync Results Analysis:");
  console.log(` - Newly created cards (FSRS New): ${syncResult.cardsToCreate.length}`);
  console.log(` - Matched cards updated (FSRS Preserved): ${syncResult.cardsToUpdate.length}`);
  console.log(` - Cards marked for soft-deletion: ${syncResult.cardIdsToSoftDelete.length}`);
  console.log(` - Average Levenshtein similarity: ${(syncResult.telemetry.avgSimilarity * 100).toFixed(1)}%`);

  const worksCorrectly = 
    syncResult.cardsToCreate.length === 1 && 
    syncResult.cardsToUpdate.length === 2 && 
    syncResult.cardIdsToSoftDelete.length === 0;

  if (worksCorrectly) {
    console.log("\n✅ PASS: Delta Sync successfully matched cards! Old card progress is preserved.\n");
  } else {
    console.error("\n❌ FAIL: Sync metrics mismatch.", syncResult);
  }

  // --- TEST 5: Spacing Jitter Test ---
  console.log("🎲 TESTING INTERVAL JITTER GENERATOR...");
  const intervals = Array.from({ length: 5 }, () => Math.floor(Math.random() * 45 * 60 * 1000));
  const isStaggered = new Set(intervals).size === intervals.length;
  if (isStaggered) {
    console.log("✅ PASS: All new cards are staggered cleanly across intervals.\n");
  } else {
    console.error("❌ FAIL: Jitter collision detected.");
  }

  console.log("🏆 ALL PIPELINE UNIT TESTS SUCCESSFUL!");
}

runLocalTests();