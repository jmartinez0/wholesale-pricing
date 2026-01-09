import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query VariantPricingWithMedia {
      products(first: 250) {
        edges {
          node {
            id
            title
            featuredMedia {
              ... on MediaImage {
                id
                image {
                  url
                }
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  sku
                  price
                  media(first: 1) {
                    nodes {
                      ... on MediaImage {
                        id
                        image {
                          url
                        }
                      }
                    }
                  }
                  wholesalePrice: metafield(namespace: "wholesale", key: "price") {
                    value
                  }
                  wholesaleMinimumQuantity: metafield(namespace: "wholesale", key: "minimum_quantity") {
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
    `
  );

  const responseJson = await response.json();
  return new Response(JSON.stringify(responseJson.data), {
    headers: { "Content-Type": "application/json" },
  });
}