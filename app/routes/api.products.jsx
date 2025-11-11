import { authenticate } from "../shopify.server"

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request)

  const response = await admin.graphql(
    `#graphql
    {
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
              wholesalePrice: metafield(namespace: "wholesale", key: "price") {
                value
              }
            }
          }
        }
      }
    }
  }
}`,
  )

  const responseJson = await response.json()
  return new Response(JSON.stringify(responseJson.data), {
    headers: { "Content-Type": "application/json" },
  })
}
