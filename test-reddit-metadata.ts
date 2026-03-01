import { fetchUrlMetadata } from "./src/lib/metadata-fetcher.js";

async function run() {
    const url = "https://www.reddit.com/r/jav/comments/1rhevbs/what_gel_or_cream_did_he_use/";
    const data = await fetchUrlMetadata(url);
    console.log(data);
}

run();
