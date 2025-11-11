import { authenticate } from "../shopify.server"

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request)

  const response = await admin.graphql(
    `#graphql`,
  )

  const responseJson = await response.json()
  return new Response(JSON.stringify(responseJson.data), {
    headers: { "Content-Type": "application/json" },
  })
}
