import { authenticate } from "../shopify.server"

export async function action({ request }) {
  const { admin } = await authenticate.admin(request)

  try {
    const { updates } = await request.json()

    if (!Array.isArray(updates) || updates.length === 0) {
      return new Response(JSON.stringify({ error: "No updates provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const metafields = updates.map(({ variantId, value }) => ({
      ownerId: variantId,
      namespace: "wholesale",
      key: "price",
      type: "money",
      value: JSON.stringify({
        amount: parseFloat(value),
        currency_code: "USD",
      }),
    }))

    const mutation = `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `

    const response = await admin.graphql(mutation, {
      variables: { metafields },
    })
    const result = await response.json()

    const errors = result?.data?.metafieldsSet?.userErrors || []

    if (errors.length > 0) {
      console.error("Shopify metafield errors: ", errors)
      return new Response(JSON.stringify({ success: false, errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Error saving wholesale prices: ", error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
