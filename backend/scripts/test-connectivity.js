
async function test() {
  console.log('Testing connectivity to api.telegram.org...');
  try {
    const res = await fetch('https://api.telegram.org', { signal: AbortSignal.timeout(5000) });
    console.log('Status:', res.status);
    console.log('OK');
  } catch (err) {
    console.error('Failed:', err);
  }
}
test();
