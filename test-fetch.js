async function testFetch() {
    const url = 'https://www.reddit.com/user/dnlnm25/saved.json?feed=487b96abd45e51b92255661b5da6ce00a425e5b8&user=dnlnm25';
    try {
        const res = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }
        });
        console.log('Status:', res.status);
        console.log('Content-Type:', res.headers.get('content-type'));
        const text = await res.text();
        console.log('Body start:', text.substring(0, 500));
    } catch (e) {
        console.error('Error:', e);
    }
}

testFetch();
