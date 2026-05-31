const SERPER_API_KEY = "b5a9c1a8cc46160c25154293463cec8346dc90c0";

async function searchSerper() {
  const data = JSON.stringify({
    "q": "buy handmade leather boots",
    "num": 10
  });

  const res = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json'
    },
    body: data
  });

  const json = await res.json();
  const domains = [];
  if (json.organic) {
    for (const result of json.organic) {
      try {
        const urlObj = new URL(result.link);
        if (!domains.includes(urlObj.hostname)) {
          domains.push(urlObj.hostname);
        }
      } catch(e){}
    }
  }
  console.log('Found domains:', domains);
}

searchSerper();
