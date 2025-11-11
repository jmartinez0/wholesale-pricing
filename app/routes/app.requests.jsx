import { useState, useEffect } from "react"

export default function Requests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchRequests() {
      setLoading(true)
      try {
        const res = await fetch("/api/requests")
        if (!res.ok) {
          console.error("Failed to fetch wholesale requests:", res.statusText)
          return
        }

        const data = await res.json()

        const requests = (data.requests?.edges || []).map((edge) => ({
          ...edge.node,
          variants: (edge.node.variants?.edges || []).map(
            (variantEdge) => variantEdge.node,
          ),
        }))

        setRequests(requests)
      } catch (err) {
        console.error("Error fetching wholesale requests:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchRequests()
  }, [])

  return (
    <s-page heading="Wholesale Access Requests">
      {loading ? (
        <s-spinner accessibilityLabel="Loading" size="large-100" />
      ) : (
        <s-stack direction="block" gap="base">
          <s-stack direction="inline" gap="base">
            <s-text-field
              icon="search"
              placeholder="Search anything"
              labelAccessibilityVisibility="Search anything"
            />
            <s-menu id="test" accessibilityLabel="More Actions Menu">
              <s-button>Here's an action</s-button>
              <s-button>Here's an action</s-button>
              <s-button>Here's an action</s-button>
            </s-menu>
          </s-stack>

          <s-section padding="none">
            <s-table>
              <s-table-header-row>
                <s-table-header>
                  <s-checkbox></s-checkbox>
                </s-table-header>
                <s-table-header></s-table-header>
                <s-table-header listSlot="primary">Email</s-table-header>
                <s-table-header>Company Name</s-table-header>
                <s-table-header>Phone Number</s-table-header>
                <s-table-header>Additional Info</s-table-header>
                <s-table-header>Status</s-table-header>
              </s-table-header-row>

              <s-table-body></s-table-body>
            </s-table>
          </s-section>
        </s-stack>
      )}
    </s-page>
  )
}
