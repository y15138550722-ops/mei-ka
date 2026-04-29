const url = process.env.VERCEL_PRODUCTION_URL || "https://meika-admin-demo-20260408.vercel.app";

const response = await fetch(url, { method: "GET" });

if (!response.ok) {
  console.error(`Vercel verification failed: ${url} returned ${response.status}`);
  process.exit(1);
}

console.log(`OK: ${url} returned ${response.status}`);
