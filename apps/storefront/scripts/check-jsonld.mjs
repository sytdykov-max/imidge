const url = process.argv[2] || "http://127.0.0.1:3002/product/shorts";

const response = await fetch(url);
const html = await response.text();

const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
const scripts = [...html.matchAll(pattern)].map((match) => match[1]);

console.log(`JSONLD_COUNT: ${scripts.length}`);

let hasProduct = false;

for (const script of scripts) {
  try {
    const data = JSON.parse(script);

    if (data?.["@type"] === "Product") {
      hasProduct = true;
      console.log("HAS_PRODUCT: true");
      console.log(`HAS_OFFERS: ${Boolean(data.offers)}`);
      console.log(`HAS_AGGREGATE_RATING: ${Boolean(data.aggregateRating)}`);
      console.log(`HAS_REVIEW: ${Boolean(data.review)}`);

      if (data.offers) {
        console.log(`OFFER_PRICE: ${data.offers.price}`);
        console.log(`OFFER_CURRENCY: ${data.offers.priceCurrency}`);
        console.log(`OFFER_AVAILABILITY: ${data.offers.availability}`);
      }

      if (data.aggregateRating) {
        console.log(`RATING_VALUE: ${data.aggregateRating.ratingValue}`);
        console.log(`RATING_COUNT: ${data.aggregateRating.ratingCount}`);
      }

      if (Array.isArray(data.review) && data.review[0]?.author?.name) {
        console.log(`REVIEW_AUTHOR: ${data.review[0].author.name}`);
      }
    }
  } catch {
    // ignore non-JSON payloads
  }
}

if (!hasProduct) {
  console.log("HAS_PRODUCT: false");
}
