const url = process.env.VERCEL_PRODUCTION_URL || "https://meika-admin-demo-20260408.vercel.app";
const attempts = Number(process.env.VERCEL_VERIFY_ATTEMPTS || 5);
const timeoutMs = Number(process.env.VERCEL_VERIFY_TIMEOUT_MS || 15000);
const retryDelayMs = Number(process.env.VERCEL_VERIFY_RETRY_DELAY_MS || 3000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let lastError;

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.ok) {
      console.log(`OK: ${url} returned ${response.status}`);
      process.exit(0);
    }

    lastError = new Error(`${url} returned ${response.status}`);
  } catch (error) {
    lastError = error;
  }

  if (attempt < attempts) {
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    console.warn(`WARN: Verification attempt ${attempt}/${attempts} failed: ${message}`);
    await sleep(retryDelayMs);
  }
}

const message = lastError instanceof Error ? lastError.message : String(lastError);
console.error(`Vercel verification failed after ${attempts} attempts: ${message}`);
process.exit(1);
